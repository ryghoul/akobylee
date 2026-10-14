const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

function harness() {
  const classes = (...initial) => {
    const values = new Set(initial);
    return { contains: x => values.has(x), add: x => values.add(x), remove: x => values.delete(x) };
  };
  let saves = 0;
  let rebindings = 0;
  const fields = Object.fromEntries(['menuDeleteMessage', 'menuDeleteNo', 'menuDeleteYes']
    .map(id => [id, { textContent: '', focus() {}, addEventListener(type, handler) { this[type] = handler; } }]));
  const modal = { classList: classes('hidden'), querySelector: selector => fields[selector.slice(1)], addEventListener() {} };
  const ctx = {
    getCurrentDrinkIdSet: () => new Set(),
    canEditMenu: () => true, menuDeletionTarget: null,
    MENU_DATA: { a: { name: 'A' }, b: { name: 'B' } }, MENU_IMAGES: { a: 'a.jpg', b: 'b.jpg' },
    ARCHIVE_MENU_ITEMS: [{ id: 'a', category: 'Spring' }, { id: 'b', category: 'Winter' }],
    archiveSectionTitles: ['Unlisted', 'Spring', 'Winter'], archiveGroupOpenState: new Map(),
    document: {
      body: { classList: classes('editor-enabled'), appendChild(node) { this.modal = node; } },
      getElementById: () => ctx.document.body.modal || null,
      createElement: () => modal,
    },
    window: { AKO: { wireModalDismiss(node) { fields.menuDeleteNo.click = () => node.classList.add('hidden'); } } },
    renderArchiveRows() {}, bindMenuRowInteractions: () => rebindings++, saveMenuState: () => saves++,
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function deleteMenuTarget('), source.indexOf('\nfunction deleteSelectedDrink(')), ctx);
  const target = (type, id, title) => ({
    id, dataset: { id }, classList: classes(type), isConnected: true,
    querySelector: () => ({ textContent: title }), querySelectorAll: () => [],
    remove() { this.isConnected = false; },
  });
  return { ctx, fields, modal, target, saves: () => saves, rebindings: () => rebindings };
}

test('No leaves a drink unchanged; Yes removes it and saves once', () => {
  const { ctx, fields, modal, target, saves, rebindings } = harness();
  const drink = target('mrow', 'a', 'A');
  ctx.requestMenuDeletion(drink);
  assert.equal(fields.menuDeleteMessage.textContent, 'Delete "A"?');
  fields.menuDeleteNo.click();
  assert.ok(modal.classList.contains('hidden'));
  assert.equal(drink.isConnected, true);
  assert.equal(ctx.ARCHIVE_MENU_ITEMS.length, 2);
  assert.equal(saves(), 0);
  ctx.requestMenuDeletion(drink);
  fields.menuDeleteYes.click();
  assert.equal(drink.isConnected, false);
  assert.equal(ctx.MENU_DATA.a, undefined);
  assert.equal(ctx.MENU_IMAGES.a, undefined);
  assert.deepEqual(ctx.ARCHIVE_MENU_ITEMS.map(item => item.id), ['b']);
  assert.equal(saves(), 1);
  assert.equal(rebindings(), 1);
});

test('section confirmation deletes its archived drinks and preserves other sections', () => {
  const { ctx, fields, target, saves } = harness();
  const section = target('archive-group', '', 'Spring');
  ctx.requestMenuDeletion(section);
  assert.match(fields.menuDeleteMessage.textContent, /section and all of its drinks/);
  fields.menuDeleteYes.click();
  assert.deepEqual(Array.from(ctx.archiveSectionTitles), ['Unlisted', 'Winter']);
  assert.deepEqual(ctx.ARCHIVE_MENU_ITEMS.map(item => item.id), ['b']);
  assert.equal(ctx.MENU_DATA.a, undefined);
  assert.ok(ctx.MENU_DATA.b);
  assert.equal(saves(), 1);
});

test('current sections delete their drinks; Unlisted remains a fallback destination', () => {
  const { ctx, fields, target } = harness();
  const current = target('menu-section', '', 'Tea');
  current.querySelectorAll = () => [{ dataset: { id: 'a' } }];
  ctx.requestMenuDeletion(current);
  fields.menuDeleteYes.click();
  assert.equal(ctx.MENU_DATA.a, undefined);
  ctx.ARCHIVE_MENU_ITEMS[0].category = 'Unlisted';
  ctx.requestMenuDeletion(target('archive-group', '', 'Unlisted'));
  assert.match(fields.menuDeleteMessage.textContent, /will remain available/);
  fields.menuDeleteYes.click();
  assert.ok(ctx.archiveSectionTitles.includes('Unlisted'));
  assert.equal(ctx.ARCHIVE_MENU_ITEMS.length, 0);
});

test('archive section deletion preserves current metadata and entries in other archive sections', () => {
  const { ctx, fields, target, saves } = harness();
  ctx.getCurrentDrinkIdSet = () => new Set(['a']);
  ctx.ARCHIVE_MENU_ITEMS.push({ id: 'a', category: 'Winter' });
  const currentRecord = ctx.MENU_DATA.a;
  ctx.requestMenuDeletion(target('archive-group', '', 'Spring'));
  fields.menuDeleteYes.click();
  assert.equal(ctx.MENU_DATA.a, currentRecord);
  assert.equal(ctx.MENU_IMAGES.a, 'a.jpg');
  assert.deepEqual(ctx.ARCHIVE_MENU_ITEMS.map(item => `${item.id}:${item.category}`), ['b:Winter', 'a:Winter']);
  assert.equal(saves(), 1);
});
