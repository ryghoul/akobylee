const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('server rejects stale tabs and safely accepts identical retries after a lost response', async () => {
  let saved = null;
  let writes = 0;
  let handler;
  const context = {
    crypto, MENU_STATE_FILE: 'memory', process: { env: {} }, console,
    requireAdmin() {},
    app: { post(route, auth, callback) { handler = callback; } },
    isValidMenuSnapshot: value => !!value && Array.isArray(value.currentSections),
    loadSavedMenuSnapshot: () => saved,
    writeJsonFile: (file, value) => { saved = structuredClone(value); writes++; },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function getMenuRevision('), source.indexOf('\nfunction isValidMenuSnapshot(')), context);
  vm.runInContext(source.slice(source.indexOf("app.post('/api/menu-state',"), source.indexOf("app.post('/api/menu-state/publish',")), context);
  const request = async (snapshot, baseRevision) => {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ body: { snapshot, baseRevision } }, response);
    return response;
  };
  const originalRevision = context.getMenuRevision(null);
  const first = { currentSections: [{ title: 'First tab' }] };
  const firstSave = await request(first, originalRevision);
  assert.equal(firstSave.code, 200);
  assert.equal(firstSave.body.revision, context.getMenuRevision(first));
  const stale = await request({ currentSections: [{ title: 'Second tab' }] }, originalRevision);
  assert.equal(stale.code, 409);
  assert.equal(stale.body.code, 'MENU_CONFLICT');
  assert.deepEqual(saved, first);
  assert.equal(writes, 1);
  const retry = await request(first, originalRevision);
  assert.equal(retry.code, 200);
  assert.equal(writes, 1);
  const next = await request({ currentSections: [{ title: 'Latest' }] }, firstSave.body.revision);
  assert.equal(next.code, 200);
  assert.equal(writes, 2);
  assert.equal((await request(first, undefined)).code, 409);
});
