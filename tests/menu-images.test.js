const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const publicDir = path.join(__dirname, '../public');

// Render runs on Linux, so photo paths must match file names exactly, case included.
function existsExactly(relativePath) {
  let dir = publicDir;
  const parts = relativePath.split('/');
  return parts.every((part, index) => {
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).includes(part)) return false;
    dir = path.join(dir, part);
    return index < parts.length - 1 || fs.statSync(dir).isFile();
  });
}

function loadRepair() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(source.indexOf('const MENU_IMAGE_PATH_FIXES'), source.indexOf('\nfunction applyMenuSnapshot('))}
    this.MENU_IMAGE_PATH_FIXES = MENU_IMAGE_PATH_FIXES; this.MENU_IMAGE_ID_PATH_FIXES = MENU_IMAGE_ID_PATH_FIXES;`, context);
  return context;
}

test('built-in menu photos and every photo repair target exist with exact letter case', () => {
  const builtIn = source.slice(0, source.indexOf('let archiveSectionTitles')).match(/'Pictures\/[^']+'/g).map(value => value.slice(1, -1));
  const { MENU_IMAGE_PATH_FIXES, MENU_IMAGE_ID_PATH_FIXES } = loadRepair();
  const targets = [...Object.values(MENU_IMAGE_PATH_FIXES), ...Object.values(MENU_IMAGE_ID_PATH_FIXES).flatMap(Object.values)].filter(Boolean);
  const missing = [...new Set([...builtIn, ...targets])].filter(imagePath => !existsExactly(imagePath));
  assert.deepEqual(missing, []);
});

test('saved menus with broken photo paths are repaired without touching valid or new photos', () => {
  const { repairMenuImagePath } = loadRepair();
  assert.equal(repairMenuImagePath('archive-chuhai', 'Pictures/menu/ikebana/CHUHAI.JPG'), 'Pictures/menu/archive/ikebana/chuhai.JPG');
  assert.equal(repairMenuImagePath('sweet-dreams', 'Pictures/menu/archive/sweet-dreams.jpg'), 'Pictures/menu/archive/sweet-dreams.JPG');
  assert.equal(repairMenuImagePath('archive-hojicha-latte-2025', 'Pictures/menu/fall.wint/ahl.JPG'), 'Pictures/menu/hojicha-latte.JPG');
  assert.equal(repairMenuImagePath('archive-coffee-no-caffeine', 'Pictures/menu/fall.wint/ahl.JPG'), '');
  assert.equal(repairMenuImagePath('milk-tea', 'Pictures/menu/current/mt.png'), 'Pictures/menu/current/mt.png');
  assert.equal(repairMenuImagePath('new', '/api/staged-images/abc.png'), '/api/staged-images/abc.png');
  assert.equal(repairMenuImagePath('odd', 'constructor'), 'constructor');
});

function publishHarness(fetchImpl) {
  const staged = `/api/staged-images/${'a'.repeat(64)}.jpg`;
  const legacy = 'data:image/png;base64,AAAA';
  const snapshotImages = () => ({ current: staged, archived: staged, legacy, plain: 'Pictures/menu/current/mt.png' });
  const snapshotItems = () => [{ id: 'archived', image: staged }, { id: 'legacy', image: legacy }];
  const uploads = [];
  const context = {
    MENU_IMAGES: snapshotImages(),
    ARCHIVE_MENU_ITEMS: snapshotItems(),
    MENU_DATA: { current: { name: 'Current' } },
    menuHistory: { undo: [{ menuImages: snapshotImages(), archiveItems: snapshotItems() }], redo: [] },
    persisted: 0,
    persistMenuHistory() { context.persisted++; },
    persistMenuSnapshot() {},
    buildMenuSnapshot: () => ({}),
    handleAdminSessionExpired() {},
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      uploads.push(body);
      return fetchImpl(body, uploads.length);
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const IMAGE_MIME_EXTENSIONS'), source.indexOf('\nasync function publishMenuStateToGitHub(')), context);
  return { context, uploads, staged, legacy };
}

const committedResponse = number => ({ ok: true, status: 200, json: async () => ({ ok: true, path: `Pictures/menu/committed-${number}.jpg` }) });

test('publish commits each staged photo once and swaps it in archive items and undo history', async () => {
  const { context, uploads, staged, legacy } = publishHarness((body, number) => committedResponse(number));
  const result = await context.resolveStagedImagesToGitHub();
  assert.equal(result.error, null);
  assert.equal(result.committed, 2);
  assert.equal(uploads.length, 2);
  assert.deepEqual(uploads.map(body => body.stagedImage ?? body.dataUrl), [staged, legacy]);
  assert.equal(uploads[0].filename, 'current.jpg');
  assert.equal(uploads[1].filename, 'legacy.png');
  assert.equal(context.MENU_IMAGES.current, 'Pictures/menu/committed-1.jpg');
  assert.equal(context.MENU_IMAGES.archived, 'Pictures/menu/committed-1.jpg');
  assert.equal(context.MENU_IMAGES.legacy, 'Pictures/menu/committed-2.jpg');
  assert.equal(context.MENU_IMAGES.plain, 'Pictures/menu/current/mt.png');
  assert.equal(context.ARCHIVE_MENU_ITEMS[0].image, 'Pictures/menu/committed-1.jpg');
  assert.equal(context.ARCHIVE_MENU_ITEMS[1].image, 'Pictures/menu/committed-2.jpg');
  assert.equal(context.menuHistory.undo[0].archiveItems[0].image, 'Pictures/menu/committed-1.jpg');
  assert.equal(context.menuHistory.undo[0].menuImages.legacy, 'Pictures/menu/committed-2.jpg');
  assert.equal(context.persisted, 1);

  uploads.length = 0;
  assert.equal((await context.resolveStagedImagesToGitHub()).committed, 0);
  assert.equal(uploads.length, 0);
});

test('a failed photo upload keeps photos already committed and reports the error', async () => {
  const { context, legacy } = publishHarness((body, number) => (number === 1
    ? committedResponse(number)
    : { ok: false, status: 500, json: async () => ({ ok: false, error: 'GitHub is down.' }) }));
  const result = await context.resolveStagedImagesToGitHub();
  assert.equal(result.committed, 1);
  assert.match(result.error.message, /GitHub is down/);
  assert.equal(context.ARCHIVE_MENU_ITEMS[0].image, 'Pictures/menu/committed-1.jpg');
  assert.equal(context.ARCHIVE_MENU_ITEMS[1].image, legacy);
});

function serverHarness() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ako-staged-'));
  const routes = {};
  const commits = [];
  const context = {
    fs, path, crypto, Buffer, console: { error() {} }, process,
    MENU_STATE_FILE: path.join(dataDir, 'menu-state.json'),
    SVG_RESPONSE_POLICY: "default-src 'none'",
    exists: p => fs.existsSync(p),
    ensureDir: dir => fs.mkdirSync(dir, { recursive: true }),
    requireAdmin() {},
    commitFileToGitHub: async (repoPath, base64) => { commits.push({ repoPath, base64 }); return { commitSha: 'abc' }; },
    app: {
      post: (route, auth, handler) => { routes[`POST ${route}`] = handler; },
      get: (route, handler) => { routes[`GET ${route}`] = handler; },
    },
  };
  vm.createContext(context);
  vm.runInContext(serverSource.slice(serverSource.indexOf('const MAX_UPLOAD_IMAGE_BYTES'), serverSource.indexOf('\n// ─────', serverSource.indexOf("app.post('/api/github/upload-image'"))), context);
  const call = async (route, req) => {
    const res = {
      code: 200, headers: {},
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
      set(headers) { Object.assign(this.headers, headers); return this; },
      end() { return this; },
      sendFile(file, callback) { this.file = file; callback?.(); },
    };
    await routes[route](req, res);
    return res;
  };
  return { call, commits, dataDir };
}

test('server stages photos by content hash and commits them from disk at publish', async () => {
  const { call, commits, dataDir } = serverHarness();
  const photo = Buffer.from('fake jpeg bytes');
  const dataUrl = `data:image/jpeg;base64,${photo.toString('base64')}`;

  const staged = await call('POST /api/staged-images', { body: { dataUrl } });
  assert.equal(staged.code, 200);
  assert.match(staged.body.path, /^\/api\/staged-images\/[a-f0-9]{64}\.jpg$/);
  const again = await call('POST /api/staged-images', { body: { dataUrl } });
  assert.equal(again.body.path, staged.body.path);
  const stagedFiles = fs.readdirSync(path.join(dataDir, 'staged-images'));
  assert.deepEqual(stagedFiles, [staged.body.path.split('/').pop()]);

  const served = await call('GET /api/staged-images/:name', { params: { name: staged.body.path.split('/').pop() } });
  assert.equal(served.file, path.join(dataDir, 'staged-images', stagedFiles[0]));
  assert.equal(served.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal((await call('GET /api/staged-images/:name', { params: { name: '../menu-state.json' } })).code, 404);

  const upload = await call('POST /api/github/upload-image', { body: { stagedImage: staged.body.path, folder: 'Pictures/menu', filename: 'drink.jpg' } });
  assert.equal(upload.code, 200);
  assert.equal(commits[0].base64, photo.toString('base64'));
  assert.match(upload.body.path, /^Pictures\/menu\/\d+-drink\.jpg$/);

  const legacy = await call('POST /api/github/upload-image', { body: { dataUrl, folder: 'Pictures/menu', filename: 'old.jpg' } });
  assert.equal(legacy.code, 200);

  const traversal = await call('POST /api/github/upload-image', { body: { stagedImage: '/api/staged-images/../../server.js', folder: 'Pictures/menu', filename: 'x.jpg' } });
  assert.equal(traversal.code, 400);
  const gone = await call('POST /api/github/upload-image', { body: { stagedImage: `/api/staged-images/${'b'.repeat(64)}.png`, folder: 'Pictures/menu', filename: 'x.png' } });
  assert.equal(gone.code, 404);
  assert.equal((await call('POST /api/staged-images', { body: { dataUrl: 'data:text/html;base64,PGI+' } })).code, 400);
  assert.equal(commits.length, 2);
  fs.rmSync(dataDir, { recursive: true, force: true });
});
