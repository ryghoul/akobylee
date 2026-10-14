const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

test('archived edits survive re-rendering, category movement, and snapshot reload', () => {
  const item = { id: 'drink', name: 'Old Name', description: 'Old description', image: 'old.jpg', category: 'Spring', note: 'Old note' };
  const archiveRows = { innerHTML: '', querySelectorAll: () => [] };
  const values = {
    menuEditorName: 'New Name', menuEditorDescription: 'New description',
    menuEditorImageUrl: 'new.jpg', menuEditorIngredients: 'Tea, Citrus',
    menuEditorProfile: 'Bright 4, Smooth 2', menuEditorNote: 'New note',
  };
  let saved;
  const context = {
    canEditMenu: () => true,
    archiveGroupOpenState: new Map(),
    ARCHIVE_MENU_ITEMS: [item], archiveSectionTitles: ['Spring', 'Winter'],
    MENU_DATA: {}, MENU_IMAGES: {}, archiveRows,
    document: { querySelectorAll: () => [], getElementById: id => ({ value: values[id] }) },
    modal: { classList: { add() {} } }, preview: { classList: { remove() {} } },
    saveMenuState() { saved = structuredClone({ items: context.ARCHIVE_MENU_ITEMS, data: context.MENU_DATA, images: context.MENU_IMAGES }); },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function getCurrentDrinkIdSet('), source.indexOf('\nconst MENU_STATE_KEY')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);
  const start = source.indexOf("modal.querySelector('#menuEditorForm').addEventListener('submit', (event) => {");
  const bodyStart = source.indexOf('\n', start);
  const bodyEnd = source.indexOf('\n  });', bodyStart);
  vm.runInContext(`function submit(event) {${source.slice(bodyStart, bodyEnd)}\n}`, context);

  context.renderArchiveRows();
  assert.equal(context.MENU_DATA.drink.desc, 'Old description');
  const event = { preventDefault() {}, currentTarget: { dataset: { editId: 'drink', source: 'archive' }, reset() {} } };
  context.submit(event);
  assert.equal(saved.items[0].name, 'New Name');
  assert.equal(saved.items[0].category, 'Spring');
  item.category = 'Winter';
  context.renderArchiveRows();
  assert.equal(context.MENU_DATA.drink.name, 'New Name');
  assert.equal(context.MENU_DATA.drink.desc, 'New description');
  assert.equal(context.MENU_DATA.drink.note, 'New note');
  assert.equal(context.MENU_IMAGES.drink, 'new.jpg');
  assert.deepEqual(Array.from(context.MENU_DATA.drink.ingredients), ['Tea', 'Citrus']);
  assert.equal(context.MENU_DATA.drink.profile.Bright, 4);

  context.ARCHIVE_MENU_ITEMS = structuredClone(saved.items);
  context.MENU_DATA = {}; context.MENU_IMAGES = {};
  context.renderArchiveRows();
  assert.equal(context.MENU_DATA.drink.name, 'New Name');
  assert.equal(context.MENU_IMAGES.drink, 'new.jpg');

  values.menuEditorDescription = ''; values.menuEditorNote = '';
  context.submit(event);
  context.renderArchiveRows();
  assert.equal(context.MENU_DATA.drink.desc, '');
  assert.equal(context.MENU_DATA.drink.note, '');
  assert.equal(context.ARCHIVE_MENU_ITEMS[0].note, '');
});

test('current drink editor recovers visible legacy descriptions and preserves deliberate clearing', () => {
  const fields = Object.fromEntries(['menuEditorName', 'menuEditorDescription', 'menuEditorImageUrl', 'menuEditorIngredients', 'menuEditorProfile', 'menuEditorNote']
    .map(id => [id, { value: '' }]));
  const form = { dataset: {}, reset() {} };
  const modal = { classList: { add() {}, remove() {} } };
  const preview = { classList: { add() {}, remove() {} } };
  Object.assign(fields, { menuEditorModal: modal, menuEditorForm: form, menuEditorPreview: preview });
  let descElement = { textContent: 'Visible legacy description' };
  const nameElement = { textContent: 'Drink' };
  const row = {
    dataset: { id: 'drink' },
    querySelector: selector => selector === '.mrow-desc' ? descElement : selector === '.mrow-name' ? nameElement : { appendChild: element => { descElement = element; } },
  };
  const context = {
    canEditMenu: () => true, ensureMenuEditorModal() {},
    MENU_DATA: { drink: { name: 'Drink', ingredients: ['Tea'], profile: { Smooth: 3 }, note: '' } },
    MENU_IMAGES: { drink: 'drink.jpg' },
    document: { getElementById: id => fields[id], querySelectorAll: () => [row], createElement: () => ({}) },
    modal, preview, saveMenuState() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function openMenuEditorForRow('), source.indexOf('\nfunction ensureDrinkPromptModal(')), context);
  const start = source.indexOf("modal.querySelector('#menuEditorForm').addEventListener('submit', (event) => {");
  const bodyStart = source.indexOf('\n', start);
  vm.runInContext(`function submit(event) {${source.slice(bodyStart, source.indexOf('\n  });', bodyStart))}\n}`, context);
  const submit = () => context.submit({ preventDefault() {}, currentTarget: form });
  context.openMenuEditorForRow('drink');
  assert.equal(fields.menuEditorDescription.value, 'Visible legacy description');
  submit();
  assert.equal(context.MENU_DATA.drink.desc, 'Visible legacy description');
  fields.menuEditorDescription.value = '';
  submit();
  context.openMenuEditorForRow('drink');
  assert.equal(fields.menuEditorDescription.value, '');
  assert.equal(descElement.textContent, '');
  descElement = null;
  fields.menuEditorDescription.value = 'New description';
  submit();
  assert.equal(descElement.textContent, 'New description');
});

test('newly added drinks store their displayed description in menu data', () => {
  const rows = [];
  const context = {
    canEditMenu: () => true, MENU_DATA: {}, MENU_IMAGES: {},
    textArea: { value: 'Name: New <svg onload=alert(1)> Tea\nDescription: Citrus <img src=x onerror=alert(1)> & tea' },
    modal: { classList: { add() {} } },
    document: { getElementById: () => null, createElement: () => ({ dataset: {} }) },
    ensureCurrentMenuSection: () => ({ appendChild: row => rows.push(row) }),
    bindMenuRowInteractions() {}, saveMenuState() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function parsePromptText('), source.indexOf('\nfunction ensureMenuEditorModal(')), context);
  const start = source.indexOf("modal.querySelector('#drinkPromptSave').addEventListener('click', () => {");
  const bodyStart = source.indexOf('\n', start);
  vm.runInContext(`function addDrink() {${source.slice(bodyStart, source.indexOf('\n  });', bodyStart))}\n}`, context);
  context.addDrink();
  assert.equal(context.MENU_DATA[rows[0].dataset.id].desc, 'Citrus <img src=x onerror=alert(1)> & tea');
  assert.ok(rows[0].innerHTML.includes('New &lt;svg onload=alert(1)&gt; Tea'));
  assert.ok(rows[0].innerHTML.includes('Citrus &lt;img src=x onerror=alert(1)&gt; &amp; tea'));
  assert.ok(!rows[0].innerHTML.includes('<img'));
  assert.ok(!rows[0].innerHTML.includes('<svg'));
});
