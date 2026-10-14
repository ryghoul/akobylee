const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));

test('new drinks are numbered after the highest number in use, ignoring archive numbers', () => {
  const context = { MENU_DATA: { a: { num: '#01' }, b: { num: '#08' }, c: { num: '#A3' }, d: {} } };
  vm.createContext(context);
  vm.runInContext(slice('function escapeMenuHtml(', 'function getCurrentDrinkIdSet('), context);
  assert.equal(context.nextMenuDrinkNumber(), '#09');
  delete context.MENU_DATA.b;
  assert.equal(context.nextMenuDrinkNumber(), '#02');
  context.MENU_DATA = {};
  assert.equal(context.nextMenuDrinkNumber(), '#01');
});

function addDrinkHarness(category) {
  const section = (title, rows = []) => ({ id: '', rows, querySelector: () => ({ textContent: title }), appendChild: row => rows.push(row) });
  const specials = section('Specials');
  const matcha = section('MATCHA');
  const alerts = [];
  let archiveRenders = 0;
  const springGroup = { open: false, querySelector: () => ({ textContent: 'Spring 2025' }) };
  const archiveRowsElement = { querySelectorAll: () => [springGroup] };
  const context = {
    canEditMenu: () => true, MENU_DATA: { old: { num: '#04' } }, MENU_IMAGES: {},
    ARCHIVE_MENU_ITEMS: [], archiveSectionTitles: ['Unlisted', 'Spring 2025'], archiveGroupOpenState: new Map(),
    textArea: { value: `Name: Test Tea\nImage path:\nCategory: ${category}` },
    modal: { classList: { add() {} } },
    document: {
      getElementById: id => (id === 'archiveRows' ? archiveRowsElement : null),
      createElement: () => ({ dataset: {} }),
      querySelectorAll: () => [specials, matcha],
    },
    ensureCurrentMenuSection: () => matcha,
    renderArchiveRows: () => archiveRenders++,
    bindMenuRowInteractions() {}, saveMenuState() {},
    alert: message => alerts.push(message),
  };
  vm.createContext(context);
  vm.runInContext(slice('function escapeMenuHtml(', 'function getCurrentDrinkIdSet('), context);
  vm.runInContext(slice('function parsePromptText(', '\nfunction ensureMenuEditorModal('), context);
  const start = source.indexOf("modal.querySelector('#drinkPromptSave').addEventListener('click', () => {");
  const bodyStart = source.indexOf('\n', start);
  vm.runInContext(`function addDrink() {${source.slice(bodyStart, source.indexOf('\n  });', bodyStart))}\n}`, context);
  context.addDrink();
  const id = Object.keys(context.MENU_DATA).find(key => key.startsWith('custom-'));
  return { context, specials, matcha, alerts, id, springGroup, archiveRenders: () => archiveRenders };
}

test('Add Drink files the drink under the section named by its Category line', () => {
  const { context, specials, matcha, alerts, id } = addDrinkHarness('specials');
  assert.equal(specials.rows.length, 1);
  assert.equal(matcha.rows.length, 0);
  assert.equal(context.MENU_DATA[id].cat, 'Specials');
  assert.equal(context.MENU_DATA[id].num, '#05');
  assert.equal(context.MENU_IMAGES[id], '');
  assert.deepEqual(alerts, []);
});

test('Add Drink can target an archive section', () => {
  const { context, specials, matcha, id, springGroup, archiveRenders } = addDrinkHarness('Spring 2025');
  assert.equal(springGroup.open, true);
  assert.equal(specials.rows.length + matcha.rows.length, 0);
  assert.equal(context.ARCHIVE_MENU_ITEMS[0].id, id);
  assert.equal(context.ARCHIVE_MENU_ITEMS[0].category, 'Spring 2025');
  assert.equal(context.archiveGroupOpenState.get('Spring 2025'), true);
  assert.equal(archiveRenders(), 1);
});

test('Add Drink with an unknown category uses the last section and says so', () => {
  const { context, matcha, alerts, id } = addDrinkHarness('Desserts');
  assert.equal(matcha.rows.length, 1);
  assert.equal(context.MENU_DATA[id].cat, 'MATCHA');
  assert.match(alerts[0], /No section is named "Desserts".*"MATCHA"/);
});

function saveStatusHarness() {
  const elements = Object.fromEntries(['menuSaveStatus', 'menuSaveMessage', 'menuRetrySave', 'menuRestoreChanges', 'menuDiscardRecovery', 'menuLoadLatest']
    .map(id => [id, { hidden: false, dataset: {}, textContent: '' }]));
  let historyResets = 0;
  const context = {
    menuSavePhase: 'idle', menuSaveError: '', menuStorageWarning: '', menuPendingBackupAvailable: true,
    menuSaveConflict: false, recoverableMenuSnapshot: null, recoverableMenuRevision: null, menuServerRevision: null,
    document: { getElementById: id => elements[id], body: { classList: { contains: () => true } } },
    initializeMenuHistory: () => historyResets++,
  };
  vm.createContext(context);
  vm.runInContext(slice('function renderMenuSaveStatus(', '\nfunction discardUnsavedMenuChanges('), context);
  return { context, elements, historyResets: () => historyResets };
}

test('editing pauses with a reload option when the shared menu did not load', async () => {
  const { context, elements, historyResets } = saveStatusHarness();
  assert.equal(context.canEditMenu(), false);
  assert.equal(context.menuSavePhase, 'unloaded');
  assert.match(elements.menuSaveMessage.textContent, /could not be loaded/);
  assert.doesNotMatch(elements.menuSaveMessage.textContent, /Another editor/);
  assert.equal(elements.menuLoadLatest.hidden, false);
  assert.equal(elements.menuLoadLatest.textContent, 'Reload menu');

  context.loadMenuStateFromServer = async () => null;
  await context.reloadSharedMenu();
  assert.equal(context.menuSavePhase, 'unloaded');
  assert.match(elements.menuSaveMessage.textContent, /still could not be loaded/);

  context.loadMenuStateFromServer = async () => { context.menuServerRevision = 'revision-1'; return true; };
  await context.reloadSharedMenu();
  assert.equal(context.menuSavePhase, 'idle');
  assert.equal(historyResets(), 1);
  assert.equal(context.canEditMenu(), true);
  assert.equal(elements.menuSaveStatus.hidden, true);
});

test('conflicts still take priority and keep the Use latest menu label', () => {
  const { context, elements } = saveStatusHarness();
  context.menuSaveConflict = true;
  assert.equal(context.canEditMenu(), false);
  assert.equal(context.menuSavePhase, 'conflict');
  assert.equal(elements.menuLoadLatest.textContent, 'Use latest menu');
});

test('in delete mode an archive header toggles, while its Delete section button deletes', () => {
  const bindSource = slice('function bindMenuRowInteractions(', '\nfunction editSelectedDrink(');
  const group = { id: '', tagName: 'DETAILS', classList: { contains: name => name === 'archive-group', add() {}, remove() {} } };
  const requested = [];
  const context = {
    document: {
      body: { classList: { contains: name => name === 'editor-enabled' || name === 'menu-delete-mode' } },
      querySelectorAll: selector => (selector.includes('.archive-group,') || selector.includes('.archive-group, ') ? [group] : []),
      getElementById: () => null,
    },
    requestMenuDeletion: target => requested.push(target),
  };
  vm.createContext(context);
  vm.runInContext(bindSource, context);
  context.bindMenuRowInteractions();
  const click = matches => {
    let prevented = false;
    group.onclick({ target: { closest: selector => (matches.includes(selector) ? {} : null) }, preventDefault() { prevented = true; }, stopPropagation() {} });
    return prevented;
  };
  assert.equal(click(['.archive-group-toggle']), false);
  assert.equal(requested.length, 0);
  assert.equal(click(['.archive-group-toggle', '.archive-group-delete']), true);
  assert.deepEqual(requested, [group]);
  click([]);
  assert.equal(requested.length, 2);
});

test('archive groups render a Delete section button after the title', () => {
  const archiveRows = { innerHTML: '', querySelectorAll: () => [] };
  const context = {
    archiveRows, archiveGroupOpenState: new Map(), archiveSectionTitles: ['Spring'],
    ARCHIVE_MENU_ITEMS: [{ id: 'a', name: 'A', category: 'Spring' }], MENU_DATA: {}, MENU_IMAGES: {},
    getCurrentDrinkIdSet: () => new Set(), openModal() {},
  };
  vm.createContext(context);
  vm.runInContext(slice('function escapeMenuHtml(', 'function getCurrentDrinkIdSet('), context);
  vm.runInContext(slice('function ensureArchiveData(', '\nconst MENU_STATE_KEY'), context);
  vm.runInContext(slice('function renderArchiveRows(', '\nfunction setupMenuTabs('), context);
  context.renderArchiveRows();
  assert.match(archiveRows.innerHTML, /<h3 class="archive-group-title">Spring<\/h3><button type="button" class="archive-group-delete">Delete section<\/button><\/summary>/);
});

test('server serves a just-committed photo until the deploy ships the real file', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ako-published-'));
  const routes = {};
  const context = {
    fs, path, crypto, Buffer, process, console: { error() {} },
    MENU_STATE_FILE: path.join(dataDir, 'menu-state.json'),
    SVG_RESPONSE_POLICY: "default-src 'none'",
    exists: p => fs.existsSync(p),
    ensureDir: dir => fs.mkdirSync(dir, { recursive: true }),
    requireAdmin() {},
    commitFileToGitHub: async () => ({ commitSha: 'abc' }),
    app: {
      post: (route, auth, handler) => { routes[`POST ${route}`] = handler; },
      get: (route, handler) => { routes[`GET ${[].concat(route).join(',')}`] = handler; },
    },
  };
  vm.createContext(context);
  vm.runInContext(serverSource.slice(serverSource.indexOf('const MAX_UPLOAD_IMAGE_BYTES'), serverSource.indexOf('\n// ─────', serverSource.indexOf("app.post('/api/github/upload-image'"))), context);
  const response = () => ({
    code: 200, headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    end() { return this; },
    sendFile(file, callback) { this.file = file; callback?.(); },
  });
  const photo = Buffer.from('photo bytes');
  const upload = response();
  await routes['POST /api/github/upload-image']({ body: { dataUrl: `data:image/png;base64,${photo.toString('base64')}`, folder: 'Pictures/menu', filename: 'drink.png' } }, upload);
  assert.equal(upload.code, 200);

  const serve = routes['GET /Pictures/menu/:name,/Pictures/merch/:name'];
  const name = upload.body.path.split('/').pop();
  const served = response();
  let passed = false;
  serve({ params: { name }, path: `/Pictures/menu/${name}` }, served, () => { passed = true; });
  assert.equal(passed, false);
  assert.deepEqual(fs.readFileSync(served.file), photo);
  assert.equal(served.headers['X-Content-Type-Options'], 'nosniff');

  for (const [requestPath, requestName] of [['/Pictures/menu/123-missing.png', '123-missing.png'], ['/Pictures/menu/mt.png', 'mt.png'], [`/Pictures/merch/${name}`, name]]) {
    let next = false;
    serve({ params: { name: requestName }, path: requestPath }, response(), () => { next = true; });
    assert.equal(next, true, requestPath);
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('photo path repair works in browsers without Object.hasOwn (Safari before 15.4)', () => {
  const context = { Object: { prototype: Object.prototype } };
  vm.createContext(context);
  vm.runInContext(slice('const MENU_IMAGE_PATH_FIXES', '\nfunction applyMenuSnapshot('), context);
  assert.equal(context.Object.hasOwn, undefined);
  assert.equal(context.repairMenuImagePath('archive-chuhai', 'Pictures/menu/ikebana/CHUHAI.JPG'), 'Pictures/menu/archive/ikebana/chuhai.JPG');
  assert.equal(context.repairMenuImagePath('archive-hojicha-latte-2025', 'Pictures/menu/fall.wint/ahl.JPG'), 'Pictures/menu/hojicha-latte.JPG');
  assert.equal(context.repairMenuImagePath('x', 'toString'), 'toString');
});

test('menu file writes replace the file whole and leave the old file if writing fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ako-write-'));
  const file = path.join(dir, 'nested', 'menu-state.json');
  const context = { fs, path, process, ensureDir: target => fs.mkdirSync(target, { recursive: true }) };
  vm.createContext(context);
  vm.runInContext(serverSource.slice(serverSource.indexOf('function readJsonFile('), serverSource.indexOf('\nfunction loadSavedMenuSnapshot(')), context);
  context.writeJsonFile(file, { version: 1 });
  context.writeJsonFile(file, { version: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { version: 2 });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['menu-state.json']);

  const circular = {};
  circular.self = circular;
  assert.throws(() => context.writeJsonFile(file, circular));
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { version: 2 });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['menu-state.json']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Escape in the delete confirmation closes it without leaving delete mode', () => {
  const start = source.indexOf("modal.addEventListener('keydown', event => {", source.indexOf('function requestMenuDeletion('));
  const handlerSource = source.slice(source.indexOf('event =>', start), source.indexOf('\n    });', start) + 6);
  const modal = { classList: { hidden: false, add(name) { if (name === 'hidden') this.hidden = true; } } };
  const context = { modal };
  vm.createContext(context);
  const handler = vm.runInContext(`(${handlerSource.replace(/\);$/, '')})`, context);
  let stopped = false;
  handler({ key: 'Escape', stopPropagation() { stopped = true; } });
  assert.equal(modal.classList.hidden, true);
  assert.equal(stopped, true);
  stopped = false;
  handler({ key: 'Enter', stopPropagation() { stopped = true; } });
  assert.equal(stopped, false);
});

function discardHarness() {
  const saved = {
    menuData: { a: { name: 'Matcha' }, b: { name: 'Hojicha' } }, menuImages: { a: 'a.jpg' },
    currentSections: [{ title: 'TEA', rows: [{ id: 'a' }, { id: 'b' }] }], archiveSections: ['Unlisted'], archiveItems: [],
  };
  const context = { confirm: () => true, lastSavedMenuSnapshot: null, buildMenuSnapshot: () => structuredClone(saved) };
  vm.createContext(context);
  vm.runInContext(slice('function describeUnsavedMenuChanges(', '\nasync function useLatestMenu('), context);
  return { context, saved };
}

test('Use latest menu lists the drinks and placement changes it would discard', () => {
  const { context, saved } = discardHarness();
  const draft = structuredClone(saved);
  draft.menuData.a.name = 'Matcha Latte';
  draft.menuData.c = { name: 'New Drink' };
  delete draft.menuData.b;
  draft.currentSections[0].rows = [{ id: 'c' }, { id: 'a' }];
  const changes = context.describeUnsavedMenuChanges(saved, draft);
  assert.deepEqual(Array.from(changes.names).sort(), ['Hojicha', 'Matcha Latte', 'New Drink']);
  assert.equal(changes.layoutChanged, true);
  assert.deepEqual(JSON.parse(JSON.stringify(context.describeUnsavedMenuChanges(saved, structuredClone(saved)))), { names: [], layoutChanged: false });

  let asked = '';
  context.lastSavedMenuSnapshot = saved;
  context.buildMenuSnapshot = () => draft;
  context.confirm = message => { asked = message; return false; };
  assert.equal(context.confirmDiscardingDraft(), false);
  assert.match(asked, /• Matcha Latte/);
  assert.match(asked, /Section or drink placement changes/);

  asked = '';
  context.buildMenuSnapshot = () => structuredClone(saved);
  assert.equal(context.confirmDiscardingDraft(), true);
  assert.equal(asked, '');

  context.lastSavedMenuSnapshot = null;
  context.confirm = message => { asked = message; return true; };
  assert.equal(context.confirmDiscardingDraft(), true);
  assert.match(asked, /discards the unsaved changes in this tab/);
});
