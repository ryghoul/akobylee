const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const between = (from, to) => serverSource.slice(serverSource.indexOf(from), serverSource.indexOf(to, serverSource.indexOf(from)));

function load() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${between('const SHOP_SECTION_STYLES', 'async function sortedShopSections(')}
    ${between('const MAX_SECTION_LABEL_LENGTH', '// POST /api/shop-sections ->')}
    this.SHOP_SECTION_STYLES = SHOP_SECTION_STYLES;`, context);
  return context;
}

const sections = [
  { key: 'shirts', label: 'Shirts' },
  { key: 'bandanas', label: 'Bandanas — S.2' },
  { key: 'fall-drop', label: 'Fall Drop' },
];

test('a collection needs a name, a known style, and a name no other collection uses', () => {
  const { sanitizeSectionInput } = load();
  assert.deepEqual({ ...sanitizeSectionInput({ label: '  Winter  ', style: 'tile' }, sections) }, { label: 'Winter', style: 'tile' });
  assert.match(sanitizeSectionInput({ label: '   ', style: 'tile' }, sections).error, /Give the collection a name/);
  assert.match(sanitizeSectionInput({ label: 'x'.repeat(61), style: 'tile' }, sections).error, /under 60/);
  assert.match(sanitizeSectionInput({ label: 'Winter', style: 'carousel' }, sections).error, /card style/);
  assert.match(sanitizeSectionInput({ label: 'Winter' }, sections).error, /card style/);
  assert.match(sanitizeSectionInput({ label: 'SHIRTS', style: 'row' }, sections).error, /already has that name/);
});

test('renaming may keep its own name, and a partial update checks only what was sent', () => {
  const { sanitizeSectionInput } = load();
  assert.deepEqual({ ...sanitizeSectionInput({ label: 'Shirts' }, sections, { partial: true, exceptKey: 'shirts' }) }, { label: 'Shirts' });
  assert.match(sanitizeSectionInput({ label: 'Fall Drop' }, sections, { partial: true, exceptKey: 'shirts' }).error, /already has that name/);
  assert.deepEqual({ ...sanitizeSectionInput({ style: 'grid' }, sections, { partial: true, exceptKey: 'shirts' }) }, { style: 'grid' });
});

test('collection keys are readable, unique, and never take the Archived key', () => {
  const { uniqueSectionKey } = load();
  assert.equal(uniqueSectionKey('Winter Drop!', sections), 'winter-drop');
  assert.equal(uniqueSectionKey('Fall Drop', sections), 'fall-drop-2');
  assert.equal(uniqueSectionKey('Archived', sections), 'archived-2');
  assert.equal(uniqueSectionKey('★★★', sections), 'collection');
});
