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

test('deleting an archive drink leaves new rows selectable and draggable', () => {
  let rows = [];
  let saves = 0;
  let detailOpens = 0;
  const group = {
    classList: classes('archive-group'),
    querySelector: selector => selector === '.archive-group-title' ? { textContent: 'Spring' } : group,
    querySelectorAll: () => rows,
  };
  const archiveRows = {
    // Simulate innerHTML replacing the nodes, not retaining old listeners.
    set innerHTML(html) {
      rows = [...html.matchAll(/data-id="([^"]+)"/g)].map(match => ({
        dataset: { id: match[1] }, classList: classes(),
        closest: selector => selector === '#archiveRows' ? archiveRows : group,
        remove() { rows = rows.filter(row => row !== this); },
        getBoundingClientRect() { return { top: rows.indexOf(this) * 100, height: 100 }; },
      }));
    },
    querySelectorAll: () => rows,
  };
  const context = {
    canEditMenu: () => true,
    archiveGroupOpenState: new Map(),
    activeMenuDrag: null, hideMenuMovementRetry() {}, showMenuMovementRetry() {},
    archiveRows, archiveSectionTitles: ['Spring'], MENU_DATA: {}, MENU_IMAGES: {},
    ARCHIVE_MENU_ITEMS: ['remove', 'first', 'last'].map(id => ({ id, name: id, category: 'Spring' })),
    document: {
      body: { classList: classes('editor-enabled') },
      querySelector: () => rows.find(row => row.classList.contains('is-selected')),
      querySelectorAll: selector => selector === '#panel-current .mrow' ? [] : selector === '.mrow' ? rows : [group],
    },
    window: { confirm: () => true },
    openModal: () => detailOpens++, saveMenuState: () => saves++,
    alert: message => assert.fail(message),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function getCurrentDrinkIdSet('), source.indexOf('\nconst MENU_STATE_KEY')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);
  vm.runInContext(source.slice(source.indexOf('function moveMenuRow('), source.indexOf('\nfunction editSelectedDrink(')), context);
  vm.runInContext(source.slice(source.indexOf('function deleteSelectedDrink('), source.indexOf('\nfunction refreshMenuEditorState(')), context);

  context.renderArchiveRows();
  context.bindMenuRowInteractions();
  const oldFirst = rows[1];
  rows[0].onclick();
  context.deleteSelectedDrink();
  assert.deepEqual(context.ARCHIVE_MENU_ITEMS.map(item => item.id), ['first', 'last']);
  assert.notEqual(rows[0], oldFirst);
  assert.equal(rows[0].draggable, true);
  rows[0].onclick();
  assert.ok(rows[0].classList.contains('is-selected'));
  assert.equal(detailOpens, 0);

  let draggedId;
  const dataTransfer = { setData: (type, id) => { draggedId = id; }, getData: () => draggedId };
  rows[0].ondragstart({ dataTransfer });
  rows[1].ondrop({ dataTransfer, clientY: 175, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(context.ARCHIVE_MENU_ITEMS.map(item => item.id), ['last', 'first']);
  assert.equal(saves, 2);
});
