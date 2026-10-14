const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const classes = (...initial) => {
  const values = new Set(initial);
  return {
    contains: value => values.has(value), add: value => values.add(value),
    remove: (...args) => args.forEach(value => values.delete(value)),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value),
  };
};

test('cross-menu drops preserve placement and details; toolbar archives to Unlisted', () => {
  const sections = [];
  const rows = [];
  const makeSection = (title, archived = false, id = '') => {
    const section = {
      id, title, classList: classes(archived ? 'archive-group' : 'menu-section'),
      querySelector(selector) { return selector === '.archive-group-rows' ? this : { textContent: title }; },
      querySelectorAll() { return rows.filter(row => row.section === this); },
      insertBefore(row, next) {
        rows.splice(rows.indexOf(row), 1);
        rows.splice(next ? rows.indexOf(next) : rows.length, 0, row);
        row.section = this;
      },
    };
    sections.push(section);
    return section;
  };
  const current = makeSection('Tea');
  const winter = makeSection('Winter', true);
  winter.tagName = 'DETAILS';
  winter.open = false;
  const unlisted = makeSection('Unlisted', true);
  const root = makeSection('Archive', false, 'archiveSection');
  const makeRow = (id, section) => {
    const row = {
      dataset: { id }, section, classList: classes(),
      closest(selector) { return selector === '#archiveRows' ? (this.section.classList.contains('archive-group') ? root : null) : this.section; },
      querySelector(selector) { return { textContent: selector === '.mrow-name' ? id : `${id} description` }; },
      getBoundingClientRect() { return { top: this.section.querySelectorAll().indexOf(this) * 100, height: 100 }; },
      remove() { this.section = unlisted; },
    };
    rows.push(row);
    return row;
  };
  const drink = makeRow('drink', current);
  makeRow('first', winter);
  makeRow('last', winter);
  const items = [{ id: 'first', category: 'Winter' }, { id: 'last', category: 'Winter' }];
  let saves = 0;
  const alerts = [];
  const context = {
    canEditMenu: () => true,
    activeMenuDrag: null, hideMenuMovementRetry() {}, showMenuMovementRetry() {},
    ARCHIVE_MENU_ITEMS: items,
    MENU_DATA: { drink: { name: 'drink', ingredients: ['Tea'], profile: { Bright: 4 }, note: 'Keep note' } },
    MENU_IMAGES: { drink: 'drink.jpg' },
    document: {
      querySelector: () => rows.find(row => row.section.classList.contains('archive-group') && row.classList.contains('is-selected')),
      body: { classList: classes('editor-enabled') },
      getElementById: id => id === 'archiveSection' ? root : { setAttribute() {} },
      querySelectorAll: selector => selector.includes('.mrow') ? rows.filter(row => !selector.includes('is-selected') || row.classList.contains('is-selected')) : sections,
    },
    renderArchiveRows() { rows.forEach(row => {
      const item = items.find(item => item.id === row.dataset.id);
      if (item) row.section = item.category === 'Winter' ? winter : unlisted;
    }); },
    saveMenuState: () => saves++, alert: message => alerts.push(message),
    ensureCurrentMenuSection: () => current,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function moveMenuRow('), source.indexOf('\nfunction editSelectedDrink(')), context);
  vm.runInContext(source.slice(source.indexOf('function moveSelectedArchiveItem('), source.indexOf('\nfunction deleteSelectedDrink(')), context);
  const drop = y => ({ clientY: y, preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => 'drink' } });
  context.bindMenuRowInteractions();
  winter.ondragover(drop(75));
  assert.equal(winter.open, true);
  winter.ondrop(drop(75));
  assert.deepEqual(items.map(item => item.id), ['first', 'drink', 'last']);
  assert.equal(items[1].image, 'drink.jpg');
  assert.equal(items[1].note, 'Keep note');
  assert.deepEqual(Array.from(items[1].ingredients), ['Tea']);
  assert.equal(drink.section, winter);

  current.ondrop(drop(0));
  assert.equal(drink.section, current);
  assert.ok(!items.some(item => item.id === 'drink'));
  assert.equal(context.MENU_DATA.drink.cat, 'Tea');
  context.moveSelectedCurrentItemToArchive();
  assert.equal(items.find(item => item.id === 'drink').category, 'Unlisted');
  assert.equal(drink.section, unlisted);
  context.moveSelectedCurrentItemToArchive();
  assert.equal(alerts.length, 1);
  assert.equal(saves, 3);

  current.ondrop(drop(0));
  root.ondragover(drop(0));
  assert.ok(root.classList.contains('open'));
  root.ondrop(drop(0));
  assert.equal(items.find(item => item.id === 'drink').category, 'Unlisted');

  // Toolbar transfer preserves the same record and row as a drag transfer.
  context.MENU_DATA.drink.num = '#A07';
  context.MENU_DATA.drink.desc = '';
  context.MENU_DATA.drink.note = '';
  const beforeTransfer = structuredClone(context.MENU_DATA.drink);
  const beforeSaves = saves;
  context.moveSelectedArchiveItem();
  assert.equal(drink.section, current);
  assert.ok(!items.some(item => item.id === 'drink'));
  assert.equal(context.MENU_DATA.drink.num, '#A07');
  assert.equal(context.MENU_DATA.drink.desc, '');
  assert.equal(context.MENU_DATA.drink.note, '');
  assert.equal(context.MENU_IMAGES.drink, 'drink.jpg');
  assert.equal(context.MENU_DATA.drink.cat, 'Tea');
  assert.equal(context.MENU_DATA.drink.category, 'Tea');
  assert.deepEqual(context.MENU_DATA.drink.ingredients, beforeTransfer.ingredients);
  assert.deepEqual(context.MENU_DATA.drink.profile, beforeTransfer.profile);
  assert.ok(drink.classList.contains('is-selected'));
  assert.equal(saves, beforeSaves + 1);
});
