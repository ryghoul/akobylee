const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const fulfillmentSource = serverSource.slice(serverSource.indexOf('const sizeFromSku'), serverSource.indexOf('\nif (stripe) {'));

// In-memory OrderEvent supporting exactly the queries fulfillment makes.
function fakeOrderEvents() {
  const docs = new Map();
  const isUnset = value => value === null || value === undefined;
  const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(option => matches(doc, option));
    const actual = doc[key];
    if (expected === null) return isUnset(actual);
    if (expected && typeof expected === 'object' && '$lt' in expected) return actual instanceof Date && actual < expected.$lt;
    return actual === expected;
  });
  const apply = (doc, update) => {
    Object.assign(doc, update.$set || {});
    Object.keys(update.$unset || {}).forEach(key => delete doc[key]);
    Object.entries(update.$addToSet || {}).forEach(([key, value]) => {
      doc[key] = doc[key] || [];
      if (!doc[key].includes(value)) doc[key].push(value);
    });
    Object.entries(update.$push || {}).forEach(([key, value]) => { doc[key] = [...(doc[key] || []), value]; });
  };
  const query = result => ({ select: () => query(result), lean: async () => (result ? structuredClone(result) : null), then: (ok, fail) => Promise.resolve(result).then(ok, fail) });
  return {
    docs,
    async findOneAndUpdate(filter, update, options = {}) {
      let doc = docs.get(filter.sessionId);
      if (!doc) {
        if (!options.upsert) return null;
        doc = { ...(update.$setOnInsert || {}) };
        docs.set(filter.sessionId, doc);
        return structuredClone(doc);
      }
      if (!matches(doc, filter)) return null;
      apply(doc, update);
      return structuredClone(doc);
    },
    findOne(filter) { return query(docs.get(filter.sessionId) || null); },
    async updateOne(filter, update) {
      const doc = docs.get(filter.sessionId);
      if (doc && matches(doc, filter)) apply(doc, update);
    },
  };
}

function harness({ paymentStatus = 'paid', stock = {}, cart = [{ sku: 'shirt|V1|M', qty: 1 }], failMailTo = null, failStockOnce = null } = {}) {
  const inventory = { ...stock };
  const mail = [];
  const failures = new Set(failMailTo ? [failMailTo] : []);
  const session = {
    id: 'cs_test_1',
    payment_status: paymentStatus,
    amount_total: 3000,
    currency: 'usd',
    metadata: { cart: JSON.stringify(cart) },
    customer_details: { email: 'buyer@example.com', name: 'Pat Buyer' },
    collected_information: { shipping_details: { name: 'Pat Buyer', address: { line1: '1 Tea St', line2: null, city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } } },
    line_items: { data: [{ description: 'Test Tee — M', quantity: 1, price: { unit_amount: 3000 } }] },
  };
  const OrderEvent = fakeOrderEvents();
  const context = {
    console: { error() {} },
    EMAIL_USER: 'shop@example.com', TO_EMAIL: 'staff@example.com',
    stripe: { checkout: { sessions: { retrieve: async id => ({ ...structuredClone(session), id }) } } },
    OrderEvent,
    Inventory: {
      collection: {
        async findOneAndUpdate(filter, pipeline) {
          if (filter.sku === failStockOnce) { failStockOnce = null; throw new Error('database dropped'); }
          if (!(filter.sku in inventory)) return null;
          const before = { sku: filter.sku, stock: inventory[filter.sku] };
          const qty = pipeline[0].$set.stock.$max[1].$subtract[1];
          inventory[filter.sku] = Math.max(0, inventory[filter.sku] - qty);
          return before;
        },
      },
    },
    getTransporter: () => ({
      async sendMail(message) {
        if (failures.has(message.to)) { failures.delete(message.to); throw new Error('SMTP down'); }
        mail.push(message);
      },
    }),
  };
  vm.createContext(context);
  vm.runInContext(`${fulfillmentSource}\nthis.itemLabel = itemLabel;`, context);
  return { context, inventory, mail, OrderEvent, session };
}

test('a paid order reduces stock and emails size, item codes and shipping address once', async () => {
  const { context, inventory, mail } = harness({ stock: { 'shirt|V1|M': 2 } });
  assert.equal((await context.fulfillPaidCheckoutSession('cs_test_1')).status, 'fulfilled');
  assert.equal(inventory['shirt|V1|M'], 1);
  assert.equal(mail.length, 2);
  const staff = mail.find(m => m.to === 'staff@example.com');
  const customer = mail.find(m => m.to === 'buyer@example.com');
  assert.match(staff.text, /Test Tee — M — 1 × \$30\.00/);
  assert.match(staff.text, /Item codes:\n• shirt\|V1\|M × 1/);
  assert.match(staff.text, /Ship to:\nPat Buyer\n1 Tea St\nAustin, TX, 78701\nUS/);
  assert.doesNotMatch(staff.subject, /Stock problem/);
  assert.match(customer.text, /Shipping to:\nPat Buyer/);

  // The webhook and the success page both run it: nothing repeats.
  await context.fulfillPaidCheckoutSession('cs_test_1');
  assert.equal(inventory['shirt|V1|M'], 1);
  assert.equal(mail.length, 2);
});

test('an order that runs out of stock is still recorded, and staff are warned', async () => {
  const { context, inventory, mail, OrderEvent } = harness({ stock: { 'shirt|V1|M': 1 }, cart: [{ sku: 'shirt|V1|M', qty: 2 }] });
  assert.equal((await context.fulfillPaidCheckoutSession('cs_test_1')).status, 'fulfilled');
  assert.equal(inventory['shirt|V1|M'], 0);
  assert.deepEqual(JSON.parse(JSON.stringify(OrderEvent.docs.get('cs_test_1').stockShortages)), [{ sku: 'shirt|V1|M', requested: 2, available: 1 }]);
  const staff = mail.find(m => m.to === 'staff@example.com');
  assert.match(staff.subject, /^⚠ Stock problem — New Order/);
  assert.match(staff.text, /NOT ENOUGH STOCK[\s\S]*shirt\|V1\|M: ordered 2, had 1/);
  assert.ok(mail.some(m => m.to === 'buyer@example.com'));
});

test('a retry after stock reduction failed partway never takes the same item twice', async () => {
  const cart = [{ sku: 'shirt|V1|M', qty: 1 }, { sku: 'tote|Black|NOSIZE', qty: 1 }];
  const { context, inventory, mail } = harness({ stock: { 'shirt|V1|M': 3, 'tote|Black|NOSIZE': 3 }, cart, failStockOnce: 'tote|Black|NOSIZE' });
  await assert.rejects(context.fulfillPaidCheckoutSession('cs_test_1'), error => error.paymentVerified === true);
  assert.deepEqual({ ...inventory }, { 'shirt|V1|M': 2, 'tote|Black|NOSIZE': 3 });
  assert.equal(mail.length, 0);
  await context.fulfillPaidCheckoutSession('cs_test_1');
  assert.deepEqual({ ...inventory }, { 'shirt|V1|M': 2, 'tote|Black|NOSIZE': 2 });
  assert.equal(mail.length, 2);
});

test('an unpaid session changes nothing', async () => {
  const { context, inventory, mail, OrderEvent } = harness({ paymentStatus: 'unpaid', stock: { 'shirt|V1|M': 2 } });
  assert.deepEqual(JSON.parse(JSON.stringify(await context.fulfillPaidCheckoutSession('cs_test_1'))), { status: 'unpaid', paymentStatus: 'unpaid' });
  assert.equal(inventory['shirt|V1|M'], 2);
  assert.equal(mail.length, 0);
  assert.equal(OrderEvent.docs.size, 0);
});

test('a failed email is retried alone, and errors after payment are marked as paid', async () => {
  const { context, mail } = harness({ stock: { 'shirt|V1|M': 2 }, failMailTo: 'staff@example.com' });
  await assert.rejects(context.fulfillPaidCheckoutSession('cs_test_1'), error => error.paymentVerified === true && /SMTP down/.test(error.message));
  assert.deepEqual(mail.map(m => m.to), ['buyer@example.com']);
  await context.fulfillPaidCheckoutSession('cs_test_1');
  assert.deepEqual(mail.map(m => m.to), ['buyer@example.com', 'staff@example.com']);
});

test('a crashed attempt’s claim is taken over after the timeout, but a live one is respected', async () => {
  const { context, inventory, OrderEvent } = harness({ stock: { 'shirt|V1|M': 2 } });
  OrderEvent.docs.set('cs_test_1', { sessionId: 'cs_test_1', decrementClaimedAt: new Date() });
  await assert.rejects(context.fulfillPaidCheckoutSession('cs_test_1'), /already in progress/);
  assert.equal(inventory['shirt|V1|M'], 2);

  OrderEvent.docs.get('cs_test_1').decrementClaimedAt = new Date(Date.now() - 11 * 60 * 1000);
  assert.equal((await context.fulfillPaidCheckoutSession('cs_test_1')).status, 'fulfilled');
  assert.equal(inventory['shirt|V1|M'], 1);
});

test('checkout items are merged per sku and validated; sizes label the item', () => {
  const { context } = harness();
  const merged = context.normalizeCheckoutItems([{ sku: 'a|M', quantity: 1 }, { sku: 'b|NOSIZE', quantity: '2' }, { sku: 'a|M', quantity: 3 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(merged)), { cart: [{ sku: 'a|M', qty: 4 }, { sku: 'b|NOSIZE', qty: 2 }] });
  assert.match(context.normalizeCheckoutItems([]).error, /No items/);
  assert.match(context.normalizeCheckoutItems([{ sku: 'a|M', quantity: 0 }]).error, /valid sku and quantity/);
  assert.match(context.normalizeCheckoutItems([{ sku: '', quantity: 1 }]).error, /valid sku and quantity/);
  assert.equal(context.itemLabel('Test Tee', 'shirt|V1|M'), 'Test Tee — M');
  assert.equal(context.itemLabel('Test Tote', 'tote|Black|NOSIZE'), 'Test Tote');
});

test('shipping address is read from the current and the older Stripe fields', () => {
  const { context } = harness();
  const address = { line1: '1 Tea St', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' };
  assert.equal(context.formatShippingAddress({ collected_information: { shipping_details: { name: 'A', address } } }), 'A\n1 Tea St\nAustin, TX, 78701\nUS');
  assert.equal(context.formatShippingAddress({ shipping_details: { name: 'B', address } }), 'B\n1 Tea St\nAustin, TX, 78701\nUS');
  assert.equal(context.formatShippingAddress({}), '');
});
