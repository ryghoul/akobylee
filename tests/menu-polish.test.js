const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const shopSource = fs.readFileSync(path.join(__dirname, '../public/shop-editor.js'), 'utf8');

function cleanupHarness({ mongoConnected = true, productImages = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ako-cleanup-'));
  const dirs = {
    staticRoot: path.join(root, 'public'),
    cache: path.join(root, 'data', 'published-images'),
    staged: path.join(root, 'data', 'staged-images'),
  };
  Object.values(dirs).forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  let query;
  const context = {
    fs, path, console: { error() {} },
    exists: p => fs.existsSync(p),
    STATIC_ROOT: dirs.staticRoot,
    PUBLISHED_IMAGE_CACHE_DIR: dirs.cache,
    STAGED_IMAGE_DIR: dirs.staged,
    MENU_STATE_FILE: path.join(root, 'data', 'menu-state.json'),
    mongoose: { connection: { readyState: mongoConnected ? 1 : 0 } },
    Product: { find: filter => { query = filter; return { lean: async () => productImages.map(image => ({ image })) }; } },
  };
  vm.createContext(context);
  const start = serverSource.indexOf('const STAGED_IMAGE_MAX_AGE_MS');
  vm.runInContext(serverSource.slice(start, serverSource.indexOf('\n// ─────', start)), context);
  const DAY = 24 * 60 * 60 * 1000;
  const write = (file, ageMs = 0) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
    const time = new Date(Date.now() - ageMs);
    fs.utimesSync(file, time, time);
    return file;
  };
  return { context, dirs, write, DAY, root, getQuery: () => query };
}

const stagedName = letter => `${letter.repeat(64)}.jpg`;

test('cleanup removes published copies once deployed and only provably unused staged photos', async () => {
  const { context, dirs, write, DAY, root, getQuery } = cleanupHarness({ productImages: [`/api/staged-images/${stagedName('c')}`] });
  const shipped = write(path.join(dirs.cache, 'Pictures/menu', '1-shipped.png'));
  write(path.join(dirs.staticRoot, 'Pictures/menu', '1-shipped.png'));
  const notShipped = write(path.join(dirs.cache, 'Pictures/merch', '2-waiting.png'), 90 * DAY);
  const oldTemp = write(path.join(dirs.cache, 'Pictures/menu', '3.png.1.2.tmp'), 2 * 60 * 60 * 1000);

  fs.writeFileSync(context.MENU_STATE_FILE, JSON.stringify({ menuImages: { a: `/api/staged-images/${stagedName('a')}` } }));
  const inMenu = write(path.join(dirs.staged, stagedName('a')), 90 * DAY);
  const unused = write(path.join(dirs.staged, stagedName('b')), 31 * DAY);
  const inShop = write(path.join(dirs.staged, stagedName('c')), 90 * DAY);
  const recent = write(path.join(dirs.staged, stagedName('d')), 2 * DAY);
  const freshTemp = write(path.join(dirs.staged, `${stagedName('e')}.1.2.tmp`), 60 * 1000);

  await context.cleanUpImageStores();
  assert.equal(fs.existsSync(shipped), false);
  assert.equal(fs.existsSync(notShipped), true);
  assert.equal(fs.existsSync(oldTemp), false);
  assert.equal(fs.existsSync(inMenu), true);
  assert.equal(fs.existsSync(unused), false);
  assert.equal(fs.existsSync(inShop), true);
  assert.equal(fs.existsSync(recent), true);
  assert.equal(fs.existsSync(freshTemp), true);
  assert.equal(getQuery().image.$regex, '^/api/staged-images/');
  fs.rmSync(root, { recursive: true, force: true });
});

test('cleanup keeps every staged photo when the shop database cannot be checked', async () => {
  const { context, dirs, write, DAY, root } = cleanupHarness({ mongoConnected: false });
  const unused = write(path.join(dirs.staged, stagedName('b')), 365 * DAY);
  await context.cleanUpImageStores();
  assert.equal(fs.existsSync(unused), true);
  fs.rmSync(root, { recursive: true, force: true });
});

function escapeHarness({ openDialogs = [], deleteMode = false } = {}) {
  let handler;
  let modalClosed = 0;
  let deleteToggles = 0;
  const context = {
    document: {
      addEventListener: (type, callback) => { if (type === 'keydown') handler = callback; },
      querySelectorAll: () => openDialogs,
      body: { classList: { contains: name => name === 'menu-delete-mode' && deleteMode } },
    },
    closeModal: () => modalClosed++,
    toggleMenuDeleteMode: () => deleteToggles++,
  };
  vm.createContext(context);
  const start = source.indexOf("document.addEventListener('keydown', e => {", source.indexOf('function initializeMenuPage('));
  vm.runInContext(source.slice(start, source.indexOf('\n});', start) + 4), context);
  return { handler, modalClosed: () => modalClosed, deleteToggles: () => deleteToggles };
}

test('Escape closes an open editor dialog before it leaves delete mode', () => {
  const dialog = { classList: { hidden: false, add(name) { if (name === 'hidden') this.hidden = true; } } };
  const withDialog = escapeHarness({ openDialogs: [dialog], deleteMode: true });
  withDialog.handler({ key: 'Escape' });
  assert.equal(dialog.classList.hidden, true);
  assert.equal(withDialog.deleteToggles(), 0);
  assert.equal(withDialog.modalClosed(), 1);

  const withoutDialog = escapeHarness({ deleteMode: true });
  withoutDialog.handler({ key: 'Escape' });
  assert.equal(withoutDialog.deleteToggles(), 1);
  withoutDialog.handler({ key: 'Enter' });
  assert.equal(withoutDialog.deleteToggles(), 1);
});

test('the built-in menu stays hidden until setup finishes, with a CSS fail-safe', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/menu.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/menu.css'), 'utf8');
  const squash = text => text.replace(/\s+/g, ' ');
  assert.ok(html.includes('class="menu-panel is-active menu-loading" id="panel-current"'));
  assert.ok(squash(css).includes('.menu-panel.menu-loading .menu-section:not(#archiveSection), .menu-panel.menu-loading #archiveRows { visibility: hidden; animation: menu-reveal 0s linear 6s forwards; }'));
  assert.ok(squash(css).includes('@keyframes menu-reveal { to { visibility: visible; } }'));
  const setup = squash(source.slice(source.lastIndexOf('initializeMenuPage()')));
  assert.ok(setup.startsWith("initializeMenuPage() .catch(error => console.error('[menu] page setup failed:', error)) .finally(() => document.getElementById('panel-current')?.classList.remove('menu-loading'));"));
});

test('shop publish commits staged and legacy product photos, and skips committed ones', async () => {
  const start = shopSource.indexOf('  const IMAGE_MIME_EXTENSIONS = {');
  const calls = [];
  const context = {
    STAGED_IMAGE_PREFIX: '/api/staged-images/',
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ ok: true, path: 'Pictures/merch/1-x.jpg' }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(shopSource.slice(start, shopSource.indexOf('\n  async function publishShopCatalogToGitHub(')), context);
  await context.resolveStagedImageForProduct({ productKey: 'shirt|V1', image: `/api/staged-images/${stagedName('a')}` });
  await context.resolveStagedImageForProduct({ productKey: 'bag', image: 'data:image/png;base64,AAAA' });
  await context.resolveStagedImageForProduct({ productKey: 'hat', image: 'Pictures/merch/hat.png' });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[0].body, { stagedImage: `/api/staged-images/${stagedName('a')}`, folder: 'Pictures/merch', filename: 'shirt-V1.jpg' });
  assert.equal(calls[1].url, `/api/shop-catalog/${encodeURIComponent('shirt|V1')}`);
  assert.deepEqual(calls[1].body, { image: 'Pictures/merch/1-x.jpg' });
  assert.equal(calls[2].body.dataUrl, 'data:image/png;base64,AAAA');
  assert.equal(calls[2].body.filename, 'bag.png');
});
