const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

test('archive and drink details escape text and IDs while retaining intended formatting', () => {
  const id = 'drink" onclick="alert(1)';
  const item = {
    id, name: '<img src=x onerror=alert(1)>', desc: '<svg onload=alert(1)> & tea',
    category: '<script>alert(1)</script>',
    ingredients: ['Tea & citrus', '<img src=x onerror=alert(1)>'],
    profile: { '<svg onload=alert(1)>': 3 },
    note: '<script>alert(1)</script>',
  };
  const context = {
    ARCHIVE_MENU_ITEMS: [item], archiveSectionTitles: [], archiveGroupOpenState: new Map(),
    archiveRows: { innerHTML: '', querySelectorAll: () => [] }, MENU_DATA: {}, MENU_IMAGES: {},
    document: { querySelectorAll: () => [], body: { style: {} } },
    modalImg: {}, modalNum: {}, modalCat: {}, modalName: {}, modalNote: {}, modalGrid: {},
    overlay: { classList: { add() {} } },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function buildDots('), source.indexOf('\nconst overlay')), context);
  vm.runInContext(source.slice(source.indexOf('function escapeMenuHtml('), source.indexOf('\nconst MENU_STATE_KEY')), context);
  vm.runInContext(source.slice(source.indexOf('function renderArchiveRows('), source.indexOf('\nfunction setupMenuTabs(')), context);
  vm.runInContext(source.slice(source.indexOf('function openModal('), source.indexOf('\nfunction closeModal(')), context);
  context.renderArchiveRows();
  const archiveHtml = context.archiveRows.innerHTML;
  assert.ok(archiveHtml.includes('data-id="drink&quot; onclick=&quot;alert(1)"'));
  assert.ok(archiveHtml.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(archiveHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!archiveHtml.includes('<script>'));
  assert.ok(!archiveHtml.includes('<img'));
  assert.ok(!archiveHtml.includes('<svg'));
  context.openModal(id);
  assert.equal(context.modalName.textContent, item.name);
  assert.equal(context.modalNote.textContent, item.note);
  assert.ok(context.modalGrid.innerHTML.includes('Tea &amp; citrus<br>&lt;img'));
  assert.ok(context.modalGrid.innerHTML.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(context.modalGrid.innerHTML.includes('class="dot filled"') || context.modalGrid.innerHTML.includes('class="dot"'));
  assert.ok(!context.modalGrid.innerHTML.includes('<img'));
  assert.ok(!context.modalGrid.innerHTML.includes('<svg'));
});
