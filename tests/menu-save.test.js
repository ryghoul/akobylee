const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const snapshot = name => ({ menuData: { drink: { name } }, menuImages: {}, currentSections: [], archiveItems: [] });
const success = () => ({ status: 200, ok: true, json: async () => ({ ok: true, revision: 'revision-1' }) });

function harness(storage = new Map()) {
  const elements = Object.fromEntries(['menuSaveStatus', 'menuSaveMessage', 'menuRetrySave', 'menuRestoreChanges', 'menuDiscardRecovery', 'menuLoadLatest']
    .map(id => [id, { hidden: false, dataset: {}, textContent: '' }]));
  let current = snapshot('Current');
  let historyResets = 0;
  let sessionExpired = 0;
  const context = {
    remoteSaveChain: Promise.resolve(), menuSaveVersion: 0, menuSavePhase: 'idle',
    menuSaveError: '', recoverableMenuSnapshot: null,
    menuStorageWarning: '', menuPendingBackupAvailable: true,
    MENU_PENDING_SAVE_KEY: 'pending', MENU_PENDING_REVISION_KEY: 'pending-revision',
    menuServerRevision: 'revision-0', menuSaveConflict: false, recoverableMenuRevision: null, MENU_STATE_URL: '/api/menu-state',
    localStorage: {
      setItem: (key, value) => storage.set(key, value),
      getItem: key => storage.get(key) || null,
      removeItem: key => storage.delete(key),
    },
    document: { getElementById: id => elements[id], body: { classList: { contains: () => true } } },
    cloneSnapshot: value => structuredClone(value),
    buildMenuSnapshot: () => current,
    applyMenuSnapshot: value => { current = structuredClone(value); },
    initializeMenuHistory: () => historyResets++,
    handleAdminSessionExpired: () => sessionExpired++,
    fetch: async () => success(),
    console: { error() {}, warn() {} },
  };
  context.sessionStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function accessMenuStorage('), source.indexOf('\nfunction saveMenuState(')), context);
  return { context, elements, storage, setCurrent: value => { current = value; }, getCurrent: () => current,
    getHistoryResets: () => historyResets, getSessionExpired: () => sessionExpired };
}

test('failed saves show retry and retain a recovery copy; retry uses latest menu', async () => {
  const { context, elements, storage, setCurrent } = harness();
  context.fetch = async () => { throw new Error('Connection lost'); };
  await assert.rejects(context.syncMenuStateToServer(snapshot('First')), /Connection lost/);
  assert.equal(elements.menuSaveStatus.dataset.phase, 'failed');
  assert.equal(elements.menuRetrySave.hidden, false);
  assert.match(elements.menuSaveMessage.textContent, /Connection lost/);
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'First');

  setCurrent(snapshot('Latest'));
  let sent;
  context.fetch = async (url, options) => { sent = JSON.parse(options.body).snapshot; return success(); };
  const retry = context.retryMenuSave();
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saving');
  assert.equal(elements.menuRetrySave.hidden, true);
  await retry;
  assert.deepEqual(sent, snapshot('Latest'));
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saved');
  assert.equal(storage.has('pending'), false);
});

test('older successful save cannot clear a newer pending snapshot or show saved', async () => {
  const { context, elements, storage } = harness();
  let finishFirst;
  context.fetch = () => new Promise(resolve => { finishFirst = () => resolve(success()); });
  const first = context.syncMenuStateToServer(snapshot('First'));
  await Promise.resolve(); await Promise.resolve();
  const latest = context.syncMenuStateToServer(snapshot('Latest'));
  context.fetch = async () => { throw new Error('Latest failed'); };
  finishFirst();
  await first;
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saving');
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'Latest');
  await assert.rejects(latest, /Latest failed/);
  assert.equal(elements.menuSaveStatus.dataset.phase, 'failed');
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'Latest');
});

test('reload offers local recovery without replacing the server menu until restored', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Unsaved'))], ['pending-revision', 'revision-0']]);
  const { context, elements, getCurrent, getHistoryResets } = harness(storage);
  context.loadRecoverableMenuChanges();
  assert.equal(elements.menuSaveStatus.dataset.phase, 'recovery');
  assert.equal(elements.menuRestoreChanges.hidden, false);
  assert.equal(getCurrent().menuData.drink.name, 'Current');
  context.restoreUnsavedMenuChanges();
  assert.equal(getCurrent().menuData.drink.name, 'Unsaved');
  assert.equal(getHistoryResets(), 1);
  assert.equal(elements.menuRetrySave.hidden, false);
  await context.retryMenuSave();
  assert.equal(storage.has('pending'), false);
});

test('expired sessions retain unsaved changes and show the error', async () => {
  const { context, elements, storage, getSessionExpired } = harness();
  context.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'Session expired' }) });
  await assert.rejects(context.syncMenuStateToServer(snapshot('Unsaved')), /Session expired/);
  assert.equal(getSessionExpired(), 1);
  assert.equal(storage.has('pending'), true);
  assert.equal(elements.menuSaveStatus.dataset.phase, 'failed');
});

test('new saves cannot overwrite unresolved recovery, including across another reload', async () => {
  const original = snapshot('Earlier unsaved');
  const storage = new Map([['pending', JSON.stringify(original)]]);
  const { context, elements } = harness(storage);
  let posts = 0;
  context.fetch = async () => { posts++; return success(); };
  context.loadRecoverableMenuChanges();
  const result = await context.syncMenuStateToServer(snapshot('New edit'));
  assert.equal(result.recoveryRequired, true);
  assert.equal(posts, 0);
  assert.deepEqual(JSON.parse(storage.get('pending')), original);
  assert.equal(elements.menuDiscardRecovery.hidden, false);
  const reloaded = harness(storage);
  reloaded.context.loadRecoverableMenuChanges();
  reloaded.context.restoreUnsavedMenuChanges();
  assert.deepEqual(reloaded.getCurrent(), original);
});

test('recovery blocks movement and history changes before they mutate the menu', () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Earlier unsaved'))]]);
  const { context } = harness(storage);
  context.menuHistory = { undo: [snapshot('Before'), snapshot('After')], redo: [] };
  context.loadRecoverableMenuChanges();
  vm.runInContext(source.slice(source.indexOf('function moveMenuRow('), source.indexOf('\nfunction bindMenuRowInteractions(')), context);
  vm.runInContext(source.slice(source.indexOf('function undoMenuChange('), source.indexOf('\nfunction renderArchiveRows(')), context);
  vm.runInContext(source.slice(source.indexOf('function deleteSelectedDrink('), source.indexOf('\nfunction refreshMenuEditorState(')), context);
  assert.equal(context.moveMenuRow(null, null), false);
  context.undoMenuChange();
  context.redoMenuChange();
  context.deleteSelectedDrink();
  assert.equal(context.menuHistory.undo.length, 2);
  assert.equal(context.menuHistory.redo.length, 0);
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'Earlier unsaved');
});

test('choosing current menu explicitly dismisses recovery and permits new saves', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Earlier unsaved'))]]);
  const { context, elements, getCurrent } = harness(storage);
  context.loadRecoverableMenuChanges();
  context.discardUnsavedMenuChanges();
  assert.equal(getCurrent().menuData.drink.name, 'Current');
  assert.equal(storage.has('pending'), false);
  assert.equal(elements.menuSaveStatus.hidden, true);
  assert.equal(context.canEditMenu(), true);
  await context.syncMenuStateToServer(snapshot('New edit'));
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saved');
});

test('full browser storage does not block menu or history updates from reaching the server', async () => {
  const { context, elements } = harness();
  context.MENU_STATE_KEY = 'state';
  context.MENU_HISTORY_KEY = 'history';
  context.MENU_HISTORY_LIMIT = 40;
  context.menuHistory = { undo: [snapshot('Before')], redo: [snapshot('Redo')] };
  context.snapshotsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  vm.runInContext(source.slice(source.indexOf('function persistMenuSnapshot('), source.indexOf('\nfunction renderCurrentSections(')), context);
  vm.runInContext(source.slice(source.indexOf('function saveMenuState('), source.indexOf('\nfunction applyLocalMenuStateFallback(')), context);
  let sent;
  context.fetch = async (url, options) => { sent = JSON.parse(options.body).snapshot; return success(); };
  assert.doesNotThrow(() => context.saveMenuState());
  await context.remoteSaveChain;
  assert.deepEqual(sent, snapshot('Current'));
  assert.equal(context.menuHistory.undo.length, 2);
  assert.equal(context.menuHistory.redo.length, 0);
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saved');
  assert.match(elements.menuSaveMessage.textContent, /Local backups may be unavailable/);
});

test('combined server and backup failures show retry without claiming reload protection', async () => {
  const { context, elements } = harness();
  context.localStorage.setItem = () => { throw new Error('Storage denied'); };
  context.fetch = async () => { throw new Error('Network failed'); };
  await assert.rejects(context.syncMenuStateToServer(snapshot('Unsaved')), /Network failed/);
  assert.equal(elements.menuRetrySave.hidden, false);
  assert.match(elements.menuSaveMessage.textContent, /could not be backed up/);
  assert.match(elements.menuSaveMessage.textContent, /Keep this page open/);
});

test('failure to clear a local backup does not report a successful server save as failed', async () => {
  const { context, elements, storage } = harness();
  context.localStorage.removeItem = () => { throw new Error('Storage denied'); };
  await context.syncMenuStateToServer(snapshot('Saved'));
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saved');
  assert.equal(elements.menuRetrySave.hidden, true);
  assert.equal(storage.has('pending'), true);
  assert.match(elements.menuSaveMessage.textContent, /outdated/);
});

test('unavailable browser storage does not prevent fallback checks or history initialization', () => {
  const { context, elements } = harness();
  context.MENU_STATE_KEY = 'state'; context.MENU_HISTORY_KEY = 'history';
  context.localStorage.getItem = () => { throw new Error('Storage denied'); };
  context.localStorage.setItem = () => { throw new Error('Storage denied'); };
  vm.runInContext(source.slice(source.indexOf('function persistMenuSnapshot('), source.indexOf('\nfunction renderCurrentSections(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyLocalMenuStateFallback('), source.indexOf('\nasync function loadMenuStateFromServer(')), context);
  vm.runInContext(source.slice(source.indexOf('function initializeMenuHistory('), source.indexOf('\nconst IMAGE_MIME_EXTENSIONS')), context);
  assert.equal(context.applyLocalMenuStateFallback(), false);
  assert.doesNotThrow(() => context.initializeMenuHistory());
  assert.equal(context.menuHistory.undo.length, 1);
  assert.doesNotThrow(() => context.loadRecoverableMenuChanges());
  assert.equal(elements.menuSaveStatus.hidden, false);
  assert.match(elements.menuSaveMessage.textContent, /Browser storage/);
});

test('conflict preserves the draft and stops queued saves from overwriting another editor', async () => {
  const { context, elements, storage } = harness();
  let posts = 0;
  context.fetch = async (url, options) => {
    posts++;
    assert.equal(JSON.parse(options.body).baseRevision, 'revision-0');
    return { status: 409, ok: false, json: async () => ({ ok: false, error: 'Newer menu exists' }) };
  };
  const first = context.syncMenuStateToServer(snapshot('First'));
  const last = context.syncMenuStateToServer(snapshot('Last'));
  await Promise.allSettled([first, last]);
  assert.equal(posts, 1);
  assert.equal(elements.menuSaveStatus.dataset.phase, 'conflict');
  assert.equal(elements.menuLoadLatest.hidden, false);
  assert.equal(context.canEditMenu(), false);
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'Last');
  context.loadMenuStateFromServer = async () => { context.applyMenuSnapshot(snapshot('Server latest')); context.menuServerRevision = 'revision-2'; return true; };
  await context.useLatestMenu();
  assert.equal(context.canEditMenu(), true);
  assert.equal(storage.has('pending'), false);
  assert.equal(context.menuServerRevision, 'revision-2');
});

test('restoring a stale draft retains its original revision instead of adopting the newer server version', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Old draft'))], ['pending-revision', 'old-revision']]);
  const { context } = harness(storage);
  context.menuServerRevision = 'new-revision';
  context.loadRecoverableMenuChanges();
  context.restoreUnsavedMenuChanges();
  context.fetch = async (url, options) => {
    assert.equal(JSON.parse(options.body).baseRevision, 'old-revision');
    return { status: 409, ok: false, json: async () => ({ ok: false }) };
  };
  await assert.rejects(context.retryMenuSave());
  assert.equal(context.menuSavePhase, 'conflict');
});

test('separate tabs cannot clear or overwrite one another’s recovery copy', async () => {
  const first = harness();
  const second = harness();
  // Both tabs share localStorage, while their sessionStorage remains isolated.
  second.context.localStorage = first.context.localStorage;
  second.context.fetch = async () => { throw new Error('Offline'); };
  await assert.rejects(second.context.syncMenuStateToServer(snapshot('Second tab draft')));
  await first.context.syncMenuStateToServer(snapshot('First tab saved'));
  assert.equal(first.storage.has('pending'), false);
  assert.equal(JSON.parse(second.storage.get('pending')).menuData.drink.name, 'Second tab draft');
  second.context.loadRecoverableMenuChanges();
  assert.equal(second.context.menuSavePhase, 'recovery');
});

test('legacy recovery without a revision can be reviewed and saved against the loaded menu', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Legacy draft'))]]);
  const { context, elements, getCurrent } = harness(storage);
  context.loadRecoverableMenuChanges();
  assert.match(elements.menuSaveMessage.textContent, /Restoring replaces the displayed menu/);
  await context.restoreUnsavedMenuChanges();
  assert.equal(getCurrent().menuData.drink.name, 'Legacy draft');
  assert.equal(storage.get('pending-revision'), 'revision-0');
  context.fetch = async (url, options) => {
    assert.equal(JSON.parse(options.body).baseRevision, 'revision-0');
    return success();
  };
  await context.retryMenuSave();
  assert.equal(elements.menuSaveStatus.dataset.phase, 'saved');
  assert.equal(storage.has('pending'), false);
});

test('legacy restore fetches a baseline without replacing the displayed menu', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Legacy draft'))]]);
  const { context, getCurrent } = harness(storage);
  context.menuServerRevision = null;
  context.loadRecoverableMenuChanges();
  context.fetch = async (url, options) => {
    assert.equal(options.method, undefined);
    assert.equal(getCurrent().menuData.drink.name, 'Current');
    return { ok: true, json: async () => ({ ok: true, snapshot: snapshot('Server latest'), revision: 'latest-revision' }) };
  };
  await context.restoreUnsavedMenuChanges();
  assert.equal(getCurrent().menuData.drink.name, 'Legacy draft');
  assert.equal(context.menuServerRevision, 'latest-revision');
  assert.equal(storage.get('pending-revision'), 'latest-revision');
});

test('failed baseline lookup keeps the legacy backup available for another restore attempt', async () => {
  const storage = new Map([['pending', JSON.stringify(snapshot('Legacy draft'))]]);
  const { context, elements, getCurrent } = harness(storage);
  context.menuServerRevision = null;
  context.loadRecoverableMenuChanges();
  context.fetch = async () => { throw new Error('Offline'); };
  await context.restoreUnsavedMenuChanges();
  assert.equal(getCurrent().menuData.drink.name, 'Current');
  assert.equal(context.recoverableMenuSnapshot.menuData.drink.name, 'Legacy draft');
  assert.equal(JSON.parse(storage.get('pending')).menuData.drink.name, 'Legacy draft');
  assert.equal(elements.menuRestoreChanges.hidden, false);
  assert.match(elements.menuSaveMessage.textContent, /backup has been kept/);
});
