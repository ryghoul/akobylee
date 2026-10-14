const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

test('creating current and archive sections persists empty drop destinations and rejects duplicates', () => {
  const makeNode = () => ({
    children: [], className: '', textContent: '',
    appendChild(child) { this.children.push(child); },
    querySelector: function () { return this.children[0]; },
    querySelectorAll: () => [],
  });
  const sections = [];
  const archive = { id: 'archiveSection', classList: { add(value) { this[value] = true; } } };
  const panel = {
    querySelectorAll: () => sections,
    insertBefore(section, before) { assert.equal(before, archive); sections.push(section); },
  };
  const archiveRows = { innerHTML: '', querySelectorAll: () => [] };
  const snapshots = [];
  let bindings = 0;
  let expanded;
  const context = {
    canEditMenu: () => true, archiveSectionTitles: ['Unlisted'], archiveGroupOpenState: new Map(),
    ARCHIVE_MENU_ITEMS: [], MENU_DATA: {}, MENU_IMAGES: {}, archiveRows,
    cloneSnapshot: value => structuredClone(value),
    getCurrentDrinkIdSet: () => new Set(),
    document: {
      body: { classList: { contains: () => true } },
      getElementById: id => id === 'panel-current' ? panel : id === 'archiveSection' ? archive : { setAttribute: (key, value) => { expanded = value; } },
      createElement: makeNode,
      querySelectorAll: selector => selector === '#panel-current .menu-section' ? [...sections, archive] : [],
    },
    bindMenuRowInteractions: () => bindings++,
    saveMenuState: () => snapshots.push(structuredClone(context.buildMenuSnapshot())),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('function getCurrentDrinkIdSet(')), context);
  vm.runInContext(source.slice(source.indexOf('function buildCurrentSectionsSnapshot('), source.indexOf('\nfunction snapshotsEqual(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);
  vm.runInContext(source.slice(source.indexOf('function addMenuSection('), source.indexOf('\nfunction createMenuSection(')), context);

  assert.equal(context.addMenuSection('  Tea Specials  ', 'current').ok, true);
  assert.equal(snapshots[0].currentSections[0].title, 'Tea Specials');
  assert.deepEqual(snapshots[0].currentSections[0].rows, []);
  assert.equal(context.addMenuSection('tea specials', 'current').ok, false);
  assert.equal(context.addMenuSection('', 'archive').ok, false);
  assert.equal(context.addMenuSection('Name', 'invalid').ok, false);
  assert.equal(context.addMenuSection('Spring & Summer <2026>', 'archive').ok, true);
  assert.ok(snapshots[1].archiveSections.includes('Spring & Summer <2026>'));
  assert.ok(archiveRows.innerHTML.includes('Spring &amp; Summer &lt;2026&gt;'));
  assert.ok(archiveRows.innerHTML.includes('<details class="archive-group" open>'));
  assert.equal(context.addMenuSection('Unlisted', 'archive').ok, false);
  assert.equal(expanded, 'true');
  assert.equal(bindings, 2);
  assert.equal(snapshots.length, 2);
  context.canEditMenu = () => false;
  assert.equal(context.addMenuSection('Blocked', 'current').ok, false);
  assert.equal(snapshots.length, 2);
});
