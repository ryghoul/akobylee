const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

test('archive drinks remain visible across renders and category moves', () => {
  const currentIds = ['duplicate'];
  const archiveRows = { innerHTML: '', querySelectorAll: () => [] };
  const items = [
    { id: 'old-a', name: 'Old A', category: 'Spring' },
    { id: 'old-b', name: 'Old A', category: 'Winter' },
    { id: 'duplicate', name: 'Renamed Archived Drink', category: 'Winter' },
    { id: 'matching-name', name: 'Current Drink', category: 'Spring' },
    { id: 'old-a', name: 'Repeated ID', category: 'Winter' },
  ];
  const context = {
    canEditMenu: () => true,
    archiveGroupOpenState: new Map(),
    archiveRows,
    ARCHIVE_MENU_ITEMS: items,
    archiveSectionTitles: ['Spring', 'Winter'],
    MENU_DATA: {},
    MENU_IMAGES: {},
    document: {
      querySelectorAll() {
        const current = currentIds.map(id => ({ dataset: { id }, closest: () => null }));
        const archived = items.filter(item => archiveRows.innerHTML.includes(`data-id="${item.id}"`))
          .map(item => ({ dataset: { id: item.id }, closest: () => archiveRows }));
        return [...current, ...archived];
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  // Exercise the real name lookup, archive data builder, and renderer together.
  vm.runInContext(source.slice(source.indexOf('function getCurrentDrinkIdSet('), source.indexOf('\nconst MENU_STATE_KEY')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);

  function checkVisibleDrinks() {
    assert.ok(archiveRows.innerHTML.includes('data-id="old-a"'));
    assert.ok(archiveRows.innerHTML.includes('data-id="old-b"'));
    assert.ok(!archiveRows.innerHTML.includes('data-id="duplicate"'));
    assert.ok(archiveRows.innerHTML.includes('data-id="matching-name"'));
    assert.equal(archiveRows.innerHTML.split('data-id="old-a"').length - 1, 1);
  }

  context.renderArchiveRows();
  checkVisibleDrinks();
  context.renderArchiveRows();
  checkVisibleDrinks();
  items[0].category = 'Winter';
  context.renderArchiveRows();
  checkVisibleDrinks();
  assert.equal(context.MENU_DATA['old-a'].cat, 'Winter');
  assert.ok(archiveRows.innerHTML.indexOf('>Unlisted</h3>') < archiveRows.innerHTML.indexOf('>Spring</h3>'));
  assert.ok(archiveRows.innerHTML.includes('<h3 class="archive-group-title">Spring</h3>'));
});

test('archive dropdowns preserve expanded and collapsed states across rendering', () => {
  const archiveRows = {
    innerHTML: '', querySelectorAll: () => [],
    children: [
      { matches: () => true, open: true, querySelector: () => ({ textContent: 'Spring' }) },
      { matches: () => true, open: false, querySelector: () => ({ textContent: 'Winter' }) },
    ],
  };
  const context = {
    canEditMenu: () => true,
    archiveRows, archiveGroupOpenState: new Map(), archiveSectionTitles: ['Spring', 'Winter'],
    ARCHIVE_MENU_ITEMS: [], getCurrentDrinkIdSet: () => new Set(),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);
  context.renderArchiveRows();
  const groups = [...archiveRows.innerHTML.matchAll(/<details class="archive-group"( open)?>\s*<summary[^>]*><h3[^>]*>([^<]+)<\/h3>/g)]
    .map(match => ({ title: match[2], open: !!match[1] }));
  assert.deepEqual(groups, [
    { title: 'Unlisted', open: false }, { title: 'Spring', open: true }, { title: 'Winter', open: false },
  ]);
});
