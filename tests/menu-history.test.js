const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

test('undo and redo send restored snapshots in order without losing redo history', async () => {
  const before = { currentSections: [{ title: 'Tea', rows: [{ id: 'drink' }] }], archiveSections: ['Spring'], archiveItems: [] };
  const after = { currentSections: [{ title: 'Tea', rows: [] }], archiveSections: ['Spring'], archiveItems: [{ id: 'drink', category: 'Spring' }] };
  const requests = [];
  const alerts = [];
  let displayed = structuredClone(after);
  let persisted = null;
  const context = {
    canEditMenu: () => true,
    menuHistory: { undo: [structuredClone(before), structuredClone(after)], redo: [] },
    remoteSaveChain: Promise.resolve(),
    menuSaveVersion: 0,
    renderMenuSaveStatus() {},
    MENU_PENDING_SAVE_KEY: 'pending', MENU_PENDING_REVISION_KEY: 'pending-revision',
    menuServerRevision: 'revision-0', menuSaveConflict: false,
    localStorage: { setItem() {}, removeItem() {} },
    MENU_STATE_URL: '/api/menu-state',
    cloneSnapshot: value => structuredClone(value),
    applyMenuSnapshot: snapshot => { displayed = structuredClone(snapshot); },
    buildMenuSnapshot: () => displayed,
    persistMenuHistory: () => { persisted = structuredClone(context.menuHistory); },
    alert: message => alerts.push(message),
    console,
    fetch: async (url, options) => {
      assert.equal(url, '/api/menu-state');
      assert.equal(options.method, 'POST');
      requests.push(JSON.parse(options.body).snapshot);
      return { status: 200, ok: true, json: async () => ({ ok: true, revision: 'revision-1' }) };
    },
  };
  context.sessionStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function accessMenuStorage('), source.indexOf('\nfunction renderMenuSaveStatus(')), context);
  // Use the real save queue and HTTP request code alongside the history actions.
  vm.runInContext(source.slice(source.indexOf('async function postMenuStateToServer('), source.indexOf('\nfunction saveMenuState(')), context);
  vm.runInContext(source.slice(source.indexOf('function undoMenuChange('), source.indexOf('\nfunction renderArchiveRows(')), context);

  const undoSave = context.undoMenuChange();
  assert.deepEqual(displayed, before);
  assert.equal(persisted.redo.length, 1);
  const redoSave = context.redoMenuChange();
  assert.deepEqual(displayed, after);
  assert.equal(persisted.redo.length, 0);
  assert.equal(persisted.undo.length, 2);
  await Promise.all([undoSave, redoSave]);
  assert.deepEqual(requests, [before, after]);

  context.redoMenuChange();
  await context.undoMenuChange();
  context.undoMenuChange();
  assert.equal(requests.length, 3);
  assert.equal(alerts.length, 2);
});
