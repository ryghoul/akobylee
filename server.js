// server.js
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cookie = require('cookie');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const packageJson = require('./package.json');

// ─────────────────────────────────────────────────────────────
// Optional Stripe (guarded if key is missing)
// ─────────────────────────────────────────────────────────────
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_KEY ? require('stripe')(STRIPE_KEY) : null;

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT) || 3000;

const STATIC_DIR  = process.env.STATIC_DIR || 'public';
const STATIC_ROOT = path.resolve(__dirname, STATIC_DIR);
const PUBLIC_BASE_URL =
  (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/,'') || `http://localhost:${PORT}`;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  || 'https://akobylee.onrender.com,http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || '';
const TO_EMAIL = process.env.TO_EMAIL || EMAIL_USER;

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const MONGO_DB  = process.env.MONGO_DB  || 'akoshop';

const repoUrl = String(packageJson.repository?.url || '');
const repoMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
const GITHUB_OWNER = process.env.GITHUB_OWNER || (repoMatch ? repoMatch[1] : '');
const GITHUB_REPO = process.env.GITHUB_REPO || (repoMatch ? repoMatch[2] : '');
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const MENU_STATE_REPO_PATH = process.env.MENU_STATE_REPO_PATH || 'data/menu-state.json';
const SHOP_CATALOG_REPO_PATH = process.env.SHOP_CATALOG_REPO_PATH || 'data/shop-catalog.json';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const ADMIN_COOKIE_NAME = 'ako_admin_session';
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
// Outside production, fall back to a per-process random secret (admin sessions reset on restart).
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET
  || (IS_PRODUCTION ? '' : crypto.randomBytes(32).toString('hex'));

if (!ADMIN_USER || !ADMIN_PASS) {
  throw new Error('ADMIN_USER and ADMIN_PASS must be set (add them to .env locally or the Render dashboard).');
}
if (IS_PRODUCTION && !ADMIN_SESSION_SECRET) {
  throw new Error('ADMIN_SESSION_SECRET is required in production.');
}

const DATA_DIR = path.resolve(__dirname, 'data');
const MENU_STATE_FILE = process.env.MENU_STATE_FILE || path.join(DATA_DIR, 'menu-state.json');

console.log('[STATIC ROOT]', STATIC_ROOT);
console.log('[BASE URL]', PUBLIC_BASE_URL);

// ─────────────────────────────────────────────────────────────
// DB (MongoDB)
// ─────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URL, { dbName: MONGO_DB })
  .then(() => console.log('[mongo] connected', mongoose.connection.host, mongoose.connection.name))
  .catch(err => console.error('[mongo] connection error', err));

// Inventory model (use external file if present, else fallback)
let Inventory;
try {
  Inventory = require('./models/Inventory');
} catch {
  const { Schema, model } = mongoose;
  const InventorySchema = new Schema({
    sku:   { type: String, unique: true, index: true, required: true },
    stock: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    active:{ type: Boolean, default: true },
  }, { collection: 'inventories', timestamps: true });
  Inventory = model('Inventory', InventorySchema);
}

const Product = require('./models/Product');
const OrderEvent = require('./models/OrderEvent');

// Sku format used everywhere: `${productKey}|${size}`. Sizes are validated
// (Product.js) to never contain "|", so splitting off the last segment
// always recovers the correct productKey even though productKey itself
// legitimately contains "|" (e.g. "shirt|V1").
const skuFor = (productKey, size) => `${productKey}|${size}`;
const productKeyFromSku = (sku) => sku.slice(0, sku.lastIndexOf('|'));

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin / curl / mobile apps (no Origin header)
    if (!origin) return cb(null, true);
    cb(null, ALLOWED_ORIGINS.includes(origin));
  }
}));
// Stripe webhook: records paid orders even when the customer never reaches
// the success page. Stripe signs each event, and verifying that signature
// needs the raw body, so this is registered before express.json() below.
// Setup: in the Stripe dashboard, add an endpoint for <site>/stripe/webhook
// sending checkout.session.completed and checkout.session.async_payment_succeeded,
// then set its signing secret as STRIPE_WEBHOOK_SECRET.
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ORDER_FULFILLMENT_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] received an event, but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set.');
    return res.status(503).json({ ok: false, error: 'Stripe webhook is not configured.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('[stripe-webhook] signature check failed:', error.message);
    return res.status(400).json({ ok: false, error: 'Invalid signature.' });
  }

  if (!ORDER_FULFILLMENT_EVENTS.has(event.type)) return res.json({ received: true });

  try {
    // An unpaid session (a delayed payment method) is acknowledged; its
    // async_payment_succeeded event arrives once the money does.
    const result = await fulfillPaidCheckoutSession(event.data.object.id);
    res.json({ received: true, status: result.status });
  } catch (error) {
    // A non-2xx reply makes Stripe retry the event (for up to three days).
    console.error('[stripe-webhook] could not finish the order; Stripe will retry:', error);
    res.status(500).json({ ok: false });
  }
});

app.use(express.urlencoded({ extended: false }));
// Default 100kb is too small for the shop/menu editors' staged image uploads —
// a picked photo rides along as a base64 data URL in the regular Save/Edit
// request body (not just the dedicated /api/github/upload-image route), and
// base64 adds ~33% overhead on top of the 5MB image cap enforced there.
app.use(express.json({ limit: '8mb' }));
// SVGs can carry scripts that run if one is opened directly (staff can upload
// SVGs), so their responses may only style themselves and embed data: URIs.
const SVG_RESPONSE_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
app.use(express.static(STATIC_ROOT, {
  fallthrough: true,
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.svg')) {
      res.setHeader('Content-Security-Policy', SVG_RESPONSE_POLICY);
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  },
}));

const exists = p => { try { return fs.existsSync(p); } catch { return false; } };

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Writes to a temp file, flushes it to disk, then renames it into place, so a
// crash mid-save leaves the previous file intact instead of a half-written one.
function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch { /* already gone */ }
    throw error;
  }
}

function loadSavedMenuSnapshot() {
  if (!exists(MENU_STATE_FILE)) return null;
  return readJsonFile(MENU_STATE_FILE);
}

function getMenuRevision(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function isValidMenuSnapshot(snapshot) {
  return isPlainObject(snapshot)
    && isPlainObject(snapshot.menuData)
    && isPlainObject(snapshot.menuImages)
    && Array.isArray(snapshot.archiveItems)
    && Array.isArray(snapshot.currentSections);
}

function signAdminPayload(payload) {
  return crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
  })).toString('base64url');
  return `${payload}.${signAdminPayload(payload)}`;
}

function verifyAdminSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = signAdminPayload(payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed || parsed.exp < Date.now() || parsed.username !== ADMIN_USER) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readAdminSession(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return verifyAdminSessionToken(cookies[ADMIN_COOKIE_NAME]);
}

function setAdminSessionCookie(res, token) {
  res.append('Set-Cookie', cookie.serialize(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    expires: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
  }));
}

function clearAdminSessionCookie(res) {
  res.append('Set-Cookie', cookie.serialize(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  }));
}

function requireAdmin(req, res, next) {
  const session = readAdminSession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'Admin sign-in required.' });
  req.adminSession = session;
  next();
}

// Commits (creates or updates) a single file in the GitHub repo via the
// Contents API — get-sha-then-PUT, so it works whether the file already
// exists or not. `base64Content` must already be base64-encoded (callers
// decide whether they're encoding JSON text or binary image data).
async function commitFileToGitHub(repoPath, base64Content, commitMessage) {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('GitHub publishing is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.');
  }

  if (typeof fetch !== 'function') {
    throw new Error('This Node runtime does not provide fetch().');
  }

  const encodedPath = repoPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodedPath}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ako-editor',
  };

  let sha;
  const existingResponse = await fetch(`${url}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
  if (existingResponse.status === 200) {
    const existing = await existingResponse.json();
    sha = existing.sha;
  } else if (existingResponse.status !== 404) {
    const message = await existingResponse.text();
    throw new Error(`GitHub lookup failed: ${existingResponse.status} ${message}`);
  }

  const publishResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMessage,
      branch: GITHUB_BRANCH,
      content: base64Content,
      sha,
    }),
  });

  if (!publishResponse.ok) {
    const message = await publishResponse.text();
    throw new Error(`GitHub publish failed: ${publishResponse.status} ${message}`);
  }

  const payload = await publishResponse.json();
  return {
    commitSha: payload.commit?.sha || '',
    commitUrl: payload.commit?.html_url || '',
    path: payload.content?.path || repoPath,
  };
}

// Shared by both JSON-snapshot publishers (menu state, shop catalog) so the
// encoding stays identical between them.
function publishJsonToGitHub(repoPath, data, commitMessage) {
  const base64 = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');
  return commitFileToGitHub(repoPath, base64, commitMessage);
}

async function publishMenuSnapshotToGitHub(snapshot) {
  return publishJsonToGitHub(MENU_STATE_REPO_PATH, snapshot, `Update shared menu state (${new Date().toISOString()})`);
}

// ─────────────────────────────────────────────────────────────
// Debug & Health
// ─────────────────────────────────────────────────────────────
if (!IS_PRODUCTION) {
  app.get('/debug/public-list', (_req, res) => {
    let list;
    try { list = fs.readdirSync(STATIC_ROOT); } catch { list = ['<missing public/>']; }
    res.json({ STATIC_ROOT, list });
  });
}
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/admin/status', (req, res) => {
  const session = readAdminSession(req);
  res.json({ ok: true, authenticated: !!session, username: session?.username || null });
});

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!safeEqual(username, ADMIN_USER) || !safeEqual(password, ADMIN_PASS)) {
    clearAdminSessionCookie(res);
    return res.status(401).json({ ok: false, error: 'Invalid staff credentials.' });
  }

  setAdminSessionCookie(res, createAdminSessionToken(username));
  res.json({ ok: true, username });
});

app.post('/api/admin/logout', (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/menu-state', (_req, res) => {
  try {
    const snapshot = loadSavedMenuSnapshot();
    res.json({ ok: true, snapshot, revision: getMenuRevision(snapshot) });
  } catch (error) {
    console.error('[menu-state] load error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load menu state.' });
  }
});

app.post('/api/menu-state', requireAdmin, async (req, res) => {
  try {
    const snapshot = req.body?.snapshot;
    if (!isValidMenuSnapshot(snapshot)) {
      return res.status(400).json({ ok: false, error: 'Invalid menu state payload.' });
    }

    const currentRevision = getMenuRevision(loadSavedMenuSnapshot());
    const revision = getMenuRevision(snapshot);
    // Check and write synchronously before publishing yields to another request.
    // Identical retries are safe when the original response was lost.
    if (req.body.baseRevision !== currentRevision && revision !== currentRevision) {
      return res.status(409).json({ ok: false, code: 'MENU_CONFLICT', error: 'Another editor saved a newer menu. Load the latest menu before editing again.' });
    }
    if (revision !== currentRevision) writeJsonFile(MENU_STATE_FILE, snapshot);

    let published = false;
    let publishResult = null;
    let publishError = null;

    if (process.env.MENU_AUTO_PUBLISH === '1') {
      try {
        publishResult = await publishMenuSnapshotToGitHub(snapshot);
        published = true;
      } catch (error) {
        publishError = error.message;
      }
    }

    res.json({
      ok: true,
      savedAt: new Date().toISOString(),
      revision,
      published,
      publishResult,
      publishError,
    });
  } catch (error) {
    console.error('[menu-state] save error:', error);
    res.status(500).json({ ok: false, error: 'Failed to save menu state.' });
  }
});

app.post('/api/menu-state/publish', requireAdmin, async (_req, res) => {
  try {
    const snapshot = loadSavedMenuSnapshot();
    if (!snapshot) {
      return res.status(400).json({ ok: false, error: 'No saved menu state to publish yet.' });
    }

    const publishResult = await publishMenuSnapshotToGitHub(snapshot);
    res.json({ ok: true, publishResult });
  } catch (error) {
    console.error('[menu-state] publish error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to publish menu state.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Pages (explicit routes)
// ─────────────────────────────────────────────────────────────
const successFile = path.join(STATIC_ROOT, 'success.html');
const shopFile    = path.join(STATIC_ROOT, 'shop.html');
const indexFile   = path.join(STATIC_ROOT, 'index.html');

const sendSuccessPage = (_req, res) => res.sendFile(successFile, err => {
  if (err) res.status(404).send('No success page. Ensure public/success.html exists.');
});
app.get('/success', sendSuccessPage);
app.get('/success.html', sendSuccessPage);
app.get('/shop', (_req, res) => exists(shopFile) ? res.sendFile(shopFile) : res.redirect('/success.html'));
app.get('/shop.html', (_req, res) => exists(shopFile) ? res.sendFile(shopFile) : res.redirect('/success.html'));

app.get('/', (_req, res) => {
  const file = exists(indexFile) ? indexFile : exists(shopFile) ? shopFile : successFile;
  res.sendFile(file, err => {
    if (err) res.status(404).send('No landing page. Ensure public/index.html or success.html exists.');
  });
});

// ─────────────────────────────────────────────────────────────
// Contact Mailer (Gmail App Password)
// ─────────────────────────────────────────────────────────────
const corsMW = cors({ origin: ALLOWED_ORIGINS });

let contactTransporter = null;
function getTransporter() {
  if (contactTransporter) return contactTransporter;
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) throw new Error('Missing EMAIL_USER or EMAIL_APP_PASSWORD env');
  contactTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
  });
  return contactTransporter;
}

const clean = (s, max = 4000) =>
  String(s ?? '').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').slice(0, max).trim();
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const lastHitByIp = new Map(); // naive spam throttle

app.options('/contact', corsMW);
app.post('/contact', corsMW, async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
             || req.socket.remoteAddress || 'unknown';
    const now = Date.now(), last = lastHitByIp.get(ip) || 0;
    if (now - last < 20000) return res.status(429).json({ message: 'Please wait before sending again.' });
    lastHitByIp.set(ip, now);

    const name    = clean(req.body?.name, 80);
    const email   = clean(req.body?.email, 254);
    const message = clean(req.body?.message, 4000);
    const honey   = clean(req.body?.website || '', 50);

    if (honey) return res.status(200).json({ message: 'Thanks!' });
    if (!name || !email || !message) return res.status(400).json({ message: 'Name, email, and message are required.' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Please provide a valid email address.' });

    const transporter = getTransporter();
    transporter.verify().catch(() => {});

    await transporter.sendMail({
      from: `"AKO Contact" <${EMAIL_USER}>`,
      to: TO_EMAIL,
      replyTo: email,
      subject: `New message from ${name}`,
      text: message,
      html: `<p><b>Name:</b> ${name}</p>
             <p><b>Email:</b> ${email}</p>
             <p>${message.replace(/\n/g,'<br>')}</p>`,
    });

    res.json({ message: 'Thanks! Your message has been sent.' });
  } catch (err) {
    const msg = err?.response || err?.message || 'Failed to send email. Check server logs.';
    console.error('[contact] error:', msg);
    res.status(500).json({ message: msg });
  }
});

// ─────────────────────────────────────────────────────────────
// Stripe checkout + order fulfillment
// ─────────────────────────────────────────────────────────────

const sizeFromSku = sku => sku.slice(sku.lastIndexOf('|') + 1);
const shownSize = size => (size && size !== 'NOSIZE' ? size : '');
const itemLabel = (name, sku) => {
  const size = shownSize(sizeFromSku(sku));
  return size ? `${name} — ${size}` : name;
};

// Merges repeated skus and validates the request: { cart: [{ sku, qty }] } or { error }.
function normalizeCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { error: 'No items in request.' };
  const qtyBySku = new Map();
  for (const item of items) {
    const sku = String(item?.sku || '').trim();
    const qty = parseInt(item?.quantity, 10);
    if (!sku || !Number.isFinite(qty) || qty < 1) return { error: 'Each item needs a valid sku and quantity.' };
    qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + qty);
  }
  return { cart: [...qtyBySku].map(([sku, qty]) => ({ sku, qty })) };
}

// Reduces stock for a paid order, never below zero. A shortfall (the item sold
// out between checkout and payment) is reported rather than thrown: the order
// is paid either way, so it must still be recorded and announced to staff.
// Each line is reported to markDone as it finishes, and lines in `done` are
// skipped, so a retry after a crash never takes the same stock twice.
async function decrementInventoryForCart(cartLines, { done = [], markDone = async () => {} } = {}) {
  const finished = new Set(done);
  for (const line of cartLines) {
    const sku = String(line?.sku || '').trim();
    const qty = parseInt(line?.qty, 10);
    if (!sku || !Number.isFinite(qty) || qty < 1 || finished.has(sku)) continue;
    const before = await Inventory.collection.findOneAndUpdate(
      { sku },
      [{ $set: { stock: { $max: [0, { $subtract: ['$stock', qty] }] } } }],
      { returnDocument: 'before' }
    );
    const available = Math.max(0, before?.stock ?? 0);
    await markDone(sku, available < qty ? { sku, requested: qty, available } : null);
    finished.add(sku);
  }
}

function formatShippingAddress(session) {
  const shipping = session.collected_information?.shipping_details || session.shipping_details || null;
  const address = shipping?.address;
  if (!address) return '';
  const cityLine = [address.city, address.state, address.postal_code].filter(Boolean).join(', ');
  return [shipping.name, address.line1, address.line2, cityLine, address.country].filter(Boolean).join('\n');
}

function describeOrderItems(session) {
  return (session.line_items?.data || []).map(item => {
    const unit = (item.price?.unit_amount || 0) / 100;
    return `• ${item.description || 'Item'} — ${item.quantity} × $${unit.toFixed(2)}`;
  }).join('\n');
}

function parseCartMetadata(session) {
  try {
    const lines = JSON.parse(session.metadata?.cart || '[]');
    return Array.isArray(lines) ? lines : [];
  } catch {
    return [];
  }
}

function tryGetMailer() { try { return getTransporter(); } catch { return null; } }

async function ensureOrderEvent(sessionId) {
  try {
    return await OrderEvent.findOneAndUpdate(
      { sessionId },
      { $setOnInsert: { sessionId } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err?.code === 11000) return OrderEvent.findOne({ sessionId });
    throw err;
  }
}

// A claim older than this belongs to an attempt that crashed, so it may be
// taken over; otherwise one crash would block that order's task forever.
const ORDER_TASK_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

async function runClaimedOrderTask(sessionId, { claimField, completedField }, task) {
  const staleBefore = new Date(Date.now() - ORDER_TASK_CLAIM_TIMEOUT_MS);
  const claimed = await OrderEvent.findOneAndUpdate(
    { sessionId, [completedField]: null, $or: [{ [claimField]: null }, { [claimField]: { $lt: staleBefore } }] },
    { $set: { [claimField]: new Date() } },
    { new: true }
  );
  if (!claimed) {
    const existing = await OrderEvent.findOne({ sessionId }).select(completedField).lean();
    if (existing?.[completedField]) return false;
    throw new Error(`Order task ${completedField} is already in progress.`);
  }

  try {
    await task();
    await OrderEvent.updateOne(
      { sessionId, [completedField]: null },
      { $set: { [completedField]: new Date() }, $unset: { [claimField]: 1 } }
    );
    return true;
  } catch (err) {
    await OrderEvent.updateOne(
      { sessionId, [completedField]: null },
      { $unset: { [claimField]: 1 } }
    );
    throw err;
  }
}

// Records a paid checkout: reduces stock, then emails the customer and staff.
// Run by both the Stripe webhook (reliable, retried by Stripe) and the
// success page (immediate). Each step is claimed and recorded once per order,
// so running it twice — or at the same time — never repeats a step.
// Returns { status: 'fulfilled' } or { status: 'unpaid', paymentStatus }.
// Errors after payment is verified carry paymentVerified = true.
async function fulfillPaidCheckoutSession(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'customer_details'],
  });
  if (session.payment_status !== 'paid') return { status: 'unpaid', paymentStatus: session.payment_status };

  try {
    const orderEvent = await ensureOrderEvent(sessionId);
    const cartLines = parseCartMetadata(session);

    if (!orderEvent.decrementedAt) {
      await runClaimedOrderTask(sessionId, {
        claimField: 'decrementClaimedAt',
        completedField: 'decrementedAt',
      }, async () => {
        const progress = await OrderEvent.findOne({ sessionId }).lean();
        await decrementInventoryForCart(cartLines, {
          done: progress?.decrementedSkus || [],
          markDone: async (sku, shortage) => {
            if (shortage) console.error('[order] paid order is short on stock:', sessionId, shortage);
            await OrderEvent.updateOne({ sessionId }, {
              $addToSet: { decrementedSkus: sku },
              ...(shortage ? { $push: { stockShortages: shortage } } : {}),
            });
          },
        });
      });
    }

    const mailer = tryGetMailer();
    // emailedAt covers legacy records; new records track each recipient
    // independently through the claimed task fields below.
    if (mailer && !orderEvent.emailedAt) {
      const latest = await OrderEvent.findOne({ sessionId }).lean();
      const shortages = latest?.stockShortages || [];
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || 'Customer';
      const amountTotal = (session.amount_total || 0) / 100;
      const currency = (session.currency || 'usd').toUpperCase();
      const list = describeOrderItems(session) || '(no items?)';
      const shipTo = formatShippingAddress(session);
      const itemCodes = cartLines.map(line => `• ${line.sku} × ${line.qty}`).join('\n');
      const shortageNote = shortages.length
        ? `⚠ NOT ENOUGH STOCK — this order is paid, but these items ran out before payment finished:
${shortages.map(s => `• ${s.sku}: ordered ${s.requested}, had ${s.available}`).join('\n')}
Restock or contact the customer before shipping.

`
        : '';

      const receiptText = `Thanks for your order, ${customerName}!

Order Summary
${list}

Total: $${amountTotal.toFixed(2)} ${currency}
${shipTo ? `\nShipping to:\n${shipTo}\n` : ''}
— AKO by Lee`;

      // Claim and record each delivery independently. If one send fails,
      // retrying does not duplicate the other recipient's message.
      await Promise.all([
        customerEmail ? runClaimedOrderTask(sessionId, {
          claimField: 'customerEmailClaimedAt',
          completedField: 'customerEmailedAt',
        }, () => mailer.sendMail({
          from: EMAIL_USER,
          to: customerEmail,
          subject: 'AKO by Lee — Order Confirmation',
          text: receiptText,
        })) : null,
        runClaimedOrderTask(sessionId, {
          claimField: 'internalEmailClaimedAt',
          completedField: 'internalEmailedAt',
        }, () => mailer.sendMail({
          from: EMAIL_USER,
          to: TO_EMAIL || EMAIL_USER,
          subject: `${shortages.length ? '⚠ Stock problem — ' : ''}New Order — ${customerEmail || customerName}`,
          text: `${shortageNote}Session: ${session.id}
Email: ${customerEmail || 'N/A'}
Name: ${customerName}
Total: $${amountTotal.toFixed(2)} ${currency}

Items:
${list}

Item codes:
${itemCodes || '(none recorded)'}

Ship to:
${shipTo || '(no shipping address collected)'}`,
        })),
      ]);
    }

    return { status: 'fulfilled' };
  } catch (err) {
    err.paymentVerified = true;
    throw err;
  }
}

if (stripe) {
  app.post('/create-checkout-session', async (req, res) => {
    try {
      // Only sku and quantity are used; any name/price the client sends is
      // ignored, never trusted for pricing.
      const { cart, error } = normalizeCheckoutItems(req.body?.items);
      if (error) return res.status(400).json({ error });
      const customer = req.body?.customer;

      // Resolve every sku to its live Product doc server-side. Only active
      // products are purchasable — this check is intentionally separate
      // from the decrement-at-confirm step, which must still work even if
      // staff deactivates/deletes the product after payment goes through.
      // Scoped to just the productKeys actually in this cart rather than
      // fetching the whole catalog — a checkout request is cart-sized work,
      // not catalog-sized.
      const candidateProductKeys = [...new Set(cart.map(line => productKeyFromSku(line.sku)))];
      const products = await Product.find({ productKey: { $in: candidateProductKeys }, active: true }).lean();
      const skuToProduct = {};
      for (const p of products) {
        for (const size of p.sizes) skuToProduct[skuFor(p.productKey, size)] = p;
      }

      // Refuse to take payment for stock that isn't there. (Two buyers can
      // still race for the last item; fulfillment then flags the shortfall.)
      const stockRows = await Inventory.find({ sku: { $in: cart.map(line => line.sku) } }, { _id: 0, sku: 1, stock: 1 }).lean();
      const stockBySku = Object.fromEntries(stockRows.map(row => [row.sku, row.stock]));

      const line_items = [];
      for (const line of cart) {
        const product = skuToProduct[line.sku];
        if (!product) {
          return res.status(400).json({ error: `"${line.sku}" is not an available item.` });
        }
        const label = itemLabel(product.name, line.sku);
        const available = Math.max(0, Number(stockBySku[line.sku]) || 0);
        if (available < line.qty) {
          return res.status(409).json({
            error: available === 0
              ? `${label} is sold out. Please remove it from your cart.`
              : `Only ${available} of ${label} left. Please lower the quantity in your cart.`,
          });
        }
        line_items.push({
          price_data: {
            currency: 'usd',
            // The size is part of the name so it shows at checkout, on the
            // receipt, and in both order emails.
            product_data: { name: label, metadata: { sku: line.sku } },
            unit_amount: product.price, // cents, resolved server-side
          },
          quantity: line.qty,
          // Disabled deliberately: the site's own cart drawer already lets
          // customers adjust quantity before checkout. If Stripe's hosted
          // UI could also adjust it, the cart snapshot stashed in session
          // metadata could go stale relative to what was actually paid for.
          adjustable_quantity: { enabled: false },
        });
      }

      const cartMetadata = JSON.stringify(cart);
      if (cartMetadata.length > 450) {
        return res.status(400).json({ error: 'Cart is too large to check out in one order — please split it into smaller orders.' });
      }

      const successUrl = `${PUBLIC_BASE_URL}/success.html?paid=1&session_id={CHECKOUT_SESSION_ID}`;
      // success.html has dedicated "checkout canceled" messaging — route
      // cancels there too rather than back to shop.html, which silently
      // ignores the ?canceled=1 param.
      const cancelUrl = `${PUBLIC_BASE_URL}/success.html?canceled=1`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items,
        customer_email: customer?.email,
        shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','JP','DE','FR','MX','SG'] },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { cart: cartMetadata },
      });

      res.json({ url: session.url });
    } catch (e) {
      console.error('Stripe error:', e);
      res.status(500).json({ error: e?.raw?.message || e.message || 'Unable to create checkout session' });
    }
  });

  // The success page's confirmation. Once Stripe says the order is paid, the
  // customer is told so even if a follow-up step fails: the webhook retries
  // those steps, and the customer's payment is not in question.
  app.get('/api/confirm-order', async (req, res) => {
    const sessionId = String(req.query.session_id || req.query.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ ok: false, error: 'Missing session_id' });
    try {
      const result = await fulfillPaidCheckoutSession(sessionId);
      if (result.status === 'unpaid') {
        return res.status(400).json({ ok: false, error: 'Payment not completed', status: result.paymentStatus });
      }
      res.json({ ok: true });
    } catch (err) {
      if (err.paymentVerified) {
        console.error('[confirm-order] paid, but finishing the order failed (the webhook will retry):', err);
        return res.json({ ok: true, pending: true });
      }
      console.error('[confirm-order] error:', err);
      res.status(500).json({ ok: false, error: err.message || 'Unable to confirm order' });
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Shop Catalog API (read)
// ─────────────────────────────────────────────────────────────

// GET /api/shop-catalog -> { ok, products: [{ ...product, stock: {size: count} }] }
// Public (matches existing GET /api/menu-state precedent); returns inactive
// products too — the storefront filters them client-side, editor mode shows
// them with a "hidden" treatment.
app.get('/api/shop-catalog', async (_req, res) => {
  try {
    const products = await Product.find({}).sort({ section: 1, order: 1, createdAt: 1 }).lean();

    const skus = [];
    for (const p of products) {
      for (const size of p.sizes) skus.push(skuFor(p.productKey, size));
    }

    const inventoryRows = skus.length
      ? await Inventory.find({ sku: { $in: skus } }, { _id: 0, sku: 1, stock: 1 }).lean()
      : [];
    const stockBySku = {};
    for (const row of inventoryRows) stockBySku[row.sku] = row.stock;

    const catalog = products.map(p => {
      const stock = {};
      for (const size of p.sizes) {
        const sku = skuFor(p.productKey, size);
        stock[size] = typeof stockBySku[sku] === 'number' ? stockBySku[sku] : 0;
      }
      return { ...p, stock };
    });

    res.json({ ok: true, products: catalog });
  } catch (e) {
    console.error('[shop-catalog] load error:', e);
    res.status(500).json({ ok: false, error: 'Failed to load shop catalog.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Shop Catalog API (write) — staff only
// ─────────────────────────────────────────────────────────────

// One entry per Product field: how to parse it out of the request body, and
// (for required fields) how to validate it. Required fields are always
// processed on a full (non-partial) submit; on a partial submit (PUT) they're
// only processed — and therefore only validated — if the caller actually
// sent them, so an update can touch just one field at a time.
const trimmedString = v => String(v || '').trim();
const PRODUCT_FIELD_SPECS = [
  { key: 'section', required: true, parse: trimmedString, valid: v => !!v, message: 'section is required' },
  { key: 'name', required: true, parse: trimmedString, valid: v => !!v, message: 'name is required' },
  { key: 'price', required: true, parse: v => Number(v), valid: v => Number.isFinite(v) && v >= 0, message: 'price must be a non-negative number (cents)' },
  {
    key: 'sizes', required: true,
    parse: v => [...new Set((Array.isArray(v) ? v : []).map(s => String(s).trim()).filter(Boolean))],
    valid: v => v.length > 0 && !v.some(s => s.includes('|')),
    message: 'sizes must be a non-empty array of strings that do not contain "|"',
  },
  { key: 'description', parse: trimmedString },
  { key: 'image', parse: trimmedString },
  { key: 'tagLabel', parse: trimmedString },
  { key: 'colorHex', parse: trimmedString },
  { key: 'accentHex', parse: trimmedString },
  { key: 'specs', parse: trimmedString },
  { key: 'presale', parse: v => !!v },
  { key: 'order', parse: v => Number(v) || 0 },
  { key: 'active', parse: v => !!v },
];

// Pulls out only the fields present in `body`, validating each as it goes.
// `partial: true` (used for PUT) skips the "required" checks for fields the
// caller didn't send, so an update can touch just one field at a time.
function sanitizeProductInput(body, { partial = false } = {}) {
  const out = {};
  const errors = [];

  for (const field of PRODUCT_FIELD_SPECS) {
    const present = body[field.key] !== undefined;
    if (field.required) {
      if (partial && !present) continue;
    } else if (!present) {
      continue;
    }

    const value = field.parse(body[field.key]);
    if (field.valid && !field.valid(value)) errors.push(field.message);
    out[field.key] = value;
  }

  return { data: out, errors };
}

// Makes sure an Inventory row exists (defaulting to 0 stock) for every sku a
// product needs, without touching rows that already exist. No transaction —
// each upsert is independently atomic, matching the rest of this file's
// no-replica-set discipline.
async function ensureInventoryRowsForProduct(productKey, sizes) {
  await Promise.all(sizes.map(size =>
    Inventory.updateOne(
      { sku: skuFor(productKey, size) },
      { $setOnInsert: { stock: 0 } },
      { upsert: true }
    )
  ));
}

// POST /api/shop-catalog -> create a product
app.post('/api/shop-catalog', requireAdmin, async (req, res) => {
  try {
    const productKey = String(req.body?.productKey || '').trim();
    if (!productKey) return res.status(400).json({ ok: false, error: 'productKey is required.' });

    const { data, errors } = sanitizeProductInput(req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join('; ') });

    const existing = await Product.findOne({ productKey }).lean();
    if (existing) return res.status(409).json({ ok: false, error: `A product with productKey "${productKey}" already exists.` });

    const product = await Product.create({ productKey, ...data });
    await ensureInventoryRowsForProduct(productKey, product.sizes);

    res.json({ ok: true, product });
  } catch (e) {
    console.error('[shop-catalog] create error:', e);
    if (e.name === 'ValidationError') return res.status(400).json({ ok: false, error: e.message });
    res.status(500).json({ ok: false, error: 'Failed to create product.' });
  }
});

// PUT /api/shop-catalog/:productKey -> update a product (productKey itself is immutable)
app.put('/api/shop-catalog/:productKey', requireAdmin, async (req, res) => {
  try {
    const productKey = req.params.productKey; // Express already decodeURIComponent()s this
    const existing = await Product.findOne({ productKey });
    if (!existing) return res.status(404).json({ ok: false, error: 'Product not found.' });

    if (req.body?.productKey !== undefined && String(req.body.productKey).trim() !== productKey) {
      return res.status(400).json({ ok: false, error: 'productKey cannot be changed. Delete and recreate instead.' });
    }

    const { data, errors } = sanitizeProductInput(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join('; ') });

    const previousSizes = new Set(existing.sizes);
    Object.assign(existing, data);
    await existing.save();

    const newSizes = existing.sizes.filter(s => !previousSizes.has(s));
    if (newSizes.length) await ensureInventoryRowsForProduct(productKey, newSizes);

    res.json({ ok: true, product: existing });
  } catch (e) {
    console.error('[shop-catalog] update error:', e);
    if (e.name === 'ValidationError') return res.status(400).json({ ok: false, error: e.message });
    res.status(500).json({ ok: false, error: 'Failed to update product.' });
  }
});

// DELETE /api/shop-catalog/:productKey -> remove a product listing
// (Inventory rows are left untouched — harmless orphans, avoids losing stock
// history and keeps a stale cart referencing this sku from crashing checkout.)
app.delete('/api/shop-catalog/:productKey', requireAdmin, async (req, res) => {
  try {
    const productKey = req.params.productKey;
    const result = await Product.deleteOne({ productKey });
    if (!result.deletedCount) return res.status(404).json({ ok: false, error: 'Product not found.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[shop-catalog] delete error:', e);
    res.status(500).json({ ok: false, error: 'Failed to delete product.' });
  }
});

// POST /api/shop-catalog/:productKey/stock -> set an absolute stock count per size
// (a $set, not a delta — staff are entering a physical count, not an adjustment)
app.post('/api/shop-catalog/:productKey/stock', requireAdmin, async (req, res) => {
  try {
    const productKey = req.params.productKey;
    const product = await Product.findOne({ productKey }).lean();
    if (!product) return res.status(404).json({ ok: false, error: 'Product not found.' });

    const stocks = req.body?.stocks;
    if (!stocks || typeof stocks !== 'object' || Array.isArray(stocks)) {
      return res.status(400).json({ ok: false, error: 'stocks must be an object of {size: count}.' });
    }

    const sizeSet = new Set(product.sizes);
    const updates = [];
    for (const [size, rawValue] of Object.entries(stocks)) {
      if (!sizeSet.has(size)) return res.status(400).json({ ok: false, error: `"${size}" is not a valid size for this product.` });
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ ok: false, error: `stock for "${size}" must be a non-negative number.` });
      updates.push({ size, value: Math.floor(value) });
    }

    await Promise.all(updates.map(({ size, value }) =>
      Inventory.updateOne(
        { sku: skuFor(productKey, size) },
        { $set: { stock: value } },
        { upsert: true }
      )
    ));

    res.json({ ok: true });
  } catch (e) {
    console.error('[shop-catalog] stock update error:', e);
    res.status(500).json({ ok: false, error: 'Failed to update stock.' });
  }
});

// POST /api/shop-catalog/publish -> commit the current catalog to GitHub as
// a JSON snapshot. Server re-reads Product itself (not client-supplied) so
// this can never publish stale data. This is a backup/version-history mirror
// only — MongoDB remains the live source of truth for what the site serves;
// publishing here does not change that. Stock/Inventory is never included.
app.post('/api/shop-catalog/publish', requireAdmin, async (_req, res) => {
  try {
    const products = await Product.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
      .sort({ section: 1, order: 1 })
      .lean();

    const publishResult = await publishJsonToGitHub(
      SHOP_CATALOG_REPO_PATH,
      products,
      `Update shop catalog (${new Date().toISOString()})`
    );

    res.json({ ok: true, publishResult });
  } catch (e) {
    console.error('[shop-catalog] publish error:', e);
    res.status(500).json({ ok: false, error: e.message || 'Failed to publish shop catalog.' });
  }
});

// POST /api/github/upload-image -> commit a staff-picked image file to the
// repo. Shared by the Menu and Shop editors, both of which stage a picked
// image as a base64 data URL locally and only call this at Publish time —
// so routine edits never touch GitHub, only a deliberate Publish click does.
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — repo history keeps every version forever
const IMAGE_MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

// Photos picked in the menu editor are staged on the same persistent disk as
// the menu snapshot, so saves carry a short URL instead of the whole photo.
// Names are content hashes, so re-picking the same photo reuses one file.
const STAGED_IMAGE_DIR = path.resolve(path.dirname(MENU_STATE_FILE), 'staged-images');
const STAGED_IMAGE_URL_PREFIX = '/api/staged-images/';
const STAGED_IMAGE_NAME = /^[a-f0-9]{64}\.(png|jpg|webp|gif|svg)$/;
// Copies of photos committed to GitHub, served until the next deploy ships them.
const PUBLISHED_IMAGE_CACHE_DIR = path.resolve(path.dirname(MENU_STATE_FILE), 'published-images');

function parseImageDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) return { error: 'dataUrl must be a base64 data: URL.' };
  const [, mimeType, base64Data] = match;
  if (!Object.hasOwn(IMAGE_MIME_EXTENSIONS, mimeType)) return { error: `Unsupported image type: ${mimeType}` };
  if (Math.ceil(base64Data.length * 0.75) > MAX_UPLOAD_IMAGE_BYTES) {
    return { error: `Image is too large (max ${MAX_UPLOAD_IMAGE_BYTES / (1024 * 1024)}MB).` };
  }
  return { mimeType, base64Data };
}

function stagedImageFile(imagePath) {
  const value = String(imagePath || '');
  if (!value.startsWith(STAGED_IMAGE_URL_PREFIX)) return null;
  const name = value.slice(STAGED_IMAGE_URL_PREFIX.length);
  return STAGED_IMAGE_NAME.test(name) ? path.join(STAGED_IMAGE_DIR, name) : null;
}

app.post('/api/staged-images', requireAdmin, (req, res) => {
  try {
    const image = parseImageDataUrl(req.body?.dataUrl);
    if (image.error) return res.status(400).json({ ok: false, error: image.error });

    const buffer = Buffer.from(image.base64Data, 'base64');
    const name = `${crypto.createHash('sha256').update(buffer).digest('hex')}.${IMAGE_MIME_EXTENSIONS[image.mimeType]}`;
    const filePath = path.join(STAGED_IMAGE_DIR, name);
    if (!exists(filePath)) {
      ensureDir(STAGED_IMAGE_DIR);
      // Write then rename so a half-written photo is never served.
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, filePath);
    } else {
      // Picked again: restart its age so cleanup treats it as recently used.
      const now = new Date();
      fs.utimesSync(filePath, now, now);
    }
    res.json({ ok: true, path: STAGED_IMAGE_URL_PREFIX + name });
  } catch (e) {
    console.error('[staged-images] save error:', e);
    res.status(500).json({ ok: false, error: 'Failed to store the photo.' });
  }
});

// Public, like GET /api/menu-state: a saved-but-unpublished menu shows these photos.
app.get('/api/staged-images/:name', (req, res) => {
  const filePath = stagedImageFile(STAGED_IMAGE_URL_PREFIX + req.params.name);
  if (!filePath) return res.status(404).end();
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': SVG_RESPONSE_POLICY,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.sendFile(filePath, error => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

app.post('/api/github/upload-image', requireAdmin, async (req, res) => {
  try {
    const { dataUrl, stagedImage, folder, filename } = req.body || {};

    let base64Data;
    if (stagedImage !== undefined) {
      const filePath = stagedImageFile(stagedImage);
      if (!filePath) return res.status(400).json({ ok: false, error: 'stagedImage must be a staged image path.' });
      if (!exists(filePath)) {
        return res.status(404).json({ ok: false, error: 'A staged photo is no longer on the server. Pick that photo again, then publish.' });
      }
      base64Data = fs.readFileSync(filePath).toString('base64');
    } else {
      const image = parseImageDataUrl(dataUrl);
      if (image.error) return res.status(400).json({ ok: false, error: image.error });
      base64Data = image.base64Data;
    }

    const allowedFolders = new Set(['Pictures/menu', 'Pictures/merch']);
    if (!allowedFolders.has(folder)) {
      return res.status(400).json({ ok: false, error: 'folder must be one of: ' + [...allowedFolders].join(', ') });
    }

    const safeName = String(filename || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!safeName) return res.status(400).json({ ok: false, error: 'filename is required.' });

    const uniqueName = `${Date.now()}-${safeName}`;
    const repoPath = `public/${folder}/${uniqueName}`;

    const publishResult = await commitFileToGitHub(
      repoPath,
      base64Data,
      `Upload image ${uniqueName} (${new Date().toISOString()})`
    );

    // The running site only gets the committed file on its next deploy, so
    // keep a copy to serve until then. The commit already succeeded, so a
    // failed copy is logged rather than reported as a failed upload.
    try {
      const copyPath = path.join(PUBLISHED_IMAGE_CACHE_DIR, folder, uniqueName);
      ensureDir(path.dirname(copyPath));
      const tempPath = `${copyPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));
      fs.renameSync(tempPath, copyPath);
    } catch (copyError) {
      console.error('[github] could not keep a local copy of the uploaded image:', copyError);
    }

    res.json({ ok: true, path: `${folder}/${uniqueName}`, publishResult });
  } catch (e) {
    console.error('[github] image upload error:', e);
    res.status(500).json({ ok: false, error: e.message || 'Failed to upload image.' });
  }
});

// Reached only when express.static has no such file yet (it falls through),
// i.e. a photo committed since the last deploy.
const PUBLISHED_IMAGE_NAME = /^\d+-[A-Za-z0-9._-]+$/;
app.get(['/Pictures/menu/:name', '/Pictures/merch/:name'], (req, res, next) => {
  const name = String(req.params.name);
  if (!PUBLISHED_IMAGE_NAME.test(name)) return next();
  const folder = req.path.startsWith('/Pictures/menu/') ? 'Pictures/menu' : 'Pictures/merch';
  const filePath = path.join(PUBLISHED_IMAGE_CACHE_DIR, folder, name);
  if (!exists(filePath)) return next();
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': SVG_RESPONSE_POLICY,
  });
  res.sendFile(filePath, error => {
    if (error && !res.headersSent) next();
  });
});

// Daily cleanup of both photo stores. It only deletes what it can prove is
// unused: a published copy once the deploy ships the real file, and a staged
// photo that is old and referenced by neither the saved menu nor any shop
// product. If the shop database can't be checked, staged photos are kept.
const STAGED_IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LEFTOVER_TEMP_MAX_AGE_MS = 60 * 60 * 1000;

function removeFileQuietly(filePath) {
  try { fs.unlinkSync(filePath); } catch (error) { console.error('[images] cleanup could not remove', filePath, error.message); }
}

function fileAgeMs(filePath, now) {
  try { return now - fs.statSync(filePath).mtimeMs; } catch { return 0; }
}

async function cleanUpImageStores(now = Date.now()) {
  for (const folder of ['Pictures/menu', 'Pictures/merch']) {
    const dir = path.join(PUBLISHED_IMAGE_CACHE_DIR, folder);
    if (!exists(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      const shipped = exists(path.join(STATIC_ROOT, folder, name));
      const leftoverTemp = name.endsWith('.tmp') && fileAgeMs(filePath, now) > LEFTOVER_TEMP_MAX_AGE_MS;
      if (shipped || leftoverTemp) removeFileQuietly(filePath);
    }
  }

  if (!exists(STAGED_IMAGE_DIR)) return;
  let references;
  try {
    if (mongoose.connection.readyState !== 1) return;
    const products = await Product.find({ image: { $regex: '^/api/staged-images/' } }, { image: 1 }).lean();
    const savedMenu = exists(MENU_STATE_FILE) ? fs.readFileSync(MENU_STATE_FILE, 'utf8') : '';
    references = savedMenu + '\n' + products.map(product => product.image).join('\n');
  } catch (error) {
    console.error('[images] cleanup skipped staged photos:', error.message);
    return;
  }
  for (const name of fs.readdirSync(STAGED_IMAGE_DIR)) {
    const filePath = path.join(STAGED_IMAGE_DIR, name);
    const isTemp = name.endsWith('.tmp');
    if (!isTemp && references.includes(name)) continue;
    if (fileAgeMs(filePath, now) > (isTemp ? LEFTOVER_TEMP_MAX_AGE_MS : STAGED_IMAGE_MAX_AGE_MS)) removeFileQuietly(filePath);
  }
}

// ─────────────────────────────────────────────────────────────
// Inventory API (atomic decrement, no replica set required)
// ─────────────────────────────────────────────────────────────

// GET /api/inventory  -> { "sku": stock, ... }
app.get('/api/inventory', async (_req, res) => {
  try {
    const items = await Inventory.find({}, { _id: 0, sku: 1, stock: 1 }).lean();
    const map = {};
    for (const it of items) map[it.sku] = it.stock;
    res.json(map);
  } catch (e) {
    console.error('[inventory] load error:', e);
    res.status(500).json({ ok: false, error: 'Failed to load inventory' });
  }
});

// ─────────────────────────────────────────────────────────────
// Catch-all for client routes (after APIs)
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/debug')) return next();

  const fallback = exists(indexFile) ? indexFile : exists(shopFile) ? shopFile : successFile;
  res.sendFile(fallback, err => {
    if (err) res.status(404).send('No fallback page. Ensure public/index.html exists.');
  });
});

// ─────────────────────────────────────────────────────────────
// Start server (single .listen!)
// ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

// Photo cleanup: shortly after start (once MongoDB has had time to connect), then daily.
const runImageCleanup = () => cleanUpImageStores().catch(error => console.error('[images] cleanup failed:', error));
setTimeout(runImageCleanup, 60 * 1000).unref();
setInterval(runImageCleanup, 24 * 60 * 60 * 1000).unref();
