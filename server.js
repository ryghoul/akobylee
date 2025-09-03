// server.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- STATIC ----------
const STATIC_DIR  = process.env.STATIC_DIR || 'public';
const STATIC_ROOT = path.resolve(__dirname, STATIC_DIR);
console.log('[STATIC ROOT]', STATIC_ROOT);

// quick debug to verify deployed files
app.get('/debug/public-list', (_req, res) => {
  let list; try { list = fs.readdirSync(STATIC_ROOT); } catch { list = ['<missing public/>']; }
  res.json({ STATIC_ROOT, list });
});

// ---------- MIDDLEWARE ----------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://akobylee.onrender.com,http://localhost:3000')
  .split(',').map(s => s.trim());

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(STATIC_ROOT));

// ---------- PAGES ----------
const successFile = path.join(STATIC_ROOT, 'success.html');
const shopFile    = path.join(STATIC_ROOT, 'shop.html');

app.get('/success', (_req, res) => res.sendFile(successFile));
app.get('/success.html', (_req, res) => res.sendFile(successFile));

app.get('/shop', (_req, res) => {
  if (fs.existsSync(shopFile)) return res.sendFile(shopFile);
  return res.redirect('/success.html');
});
app.get('/shop.html', (_req, res) => {
  if (fs.existsSync(shopFile)) return res.sendFile(shopFile);
  return res.redirect('/success.html');
});

// Root – try index.html; fall back to shop.html; then success.html
app.get('/', (_req, res) => {
  const indexFile = path.join(STATIC_ROOT, 'index.html');
  const file = fs.existsSync(indexFile) ? indexFile
             : fs.existsSync(shopFile)  ? shopFile
             : successFile;
  res.sendFile(file, err => {
    if (err) res.status(404).send('No landing page. Ensure public/index.html or success.html exists.');
  });
});

// ---------- STRIPE: CREATE CHECKOUT (redirects to success.html) ----------
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items = [], customer } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in request.' });
    }

    const line_items = items.map(i => ({
      price_data: { currency: 'usd', product_data: { name: i.name }, unit_amount: i.price },
      quantity: i.quantity,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
    }));

    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const successUrl = `${base}/success.html?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = fs.existsSync(shopFile)
      ? `${base}/shop.html?canceled=1`
      : `${base}/success.html?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','JP','DE','FR','MX','SG'] },
      success_url: successUrl,
      cancel_url:  cancelUrl,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe error:', e);
    res.status(500).json({ error: e?.raw?.message || e.message || 'Unable to create checkout session' });
  }
});

// ---------- CONFIRM ORDER (no webhook) ----------
const emailedSessions = new Set(); // idempotency

app.get('/api/confirm-order', async (req, res) => {
  try {
    const session_id = req.query.session_id || req.query.sessionId;
    if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'customer_details']
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed', status: session.payment_status });
    }

    if (!emailedSessions.has(session_id)) {
      const items = session.line_items?.data || [];
      const customerEmail = session.customer_details?.email || session.customer_email;
      const name = session.customer_details?.name || 'Customer';
      const amountTotal = (session.amount_total || 0) / 100;
      const currency = (session.currency || 'usd').toUpperCase();

      const list = items.map(i => {
        const unit = (i.price?.unit_amount || 0) / 100;
        return `• ${i.description} — ${i.quantity} × $${unit.toFixed(2)}`;
      }).join('\n');

      const receipt = `Thanks for your order, ${name}!

Order Summary
${list || '(no items?)'}

Total: $${amountTotal.toFixed(2)} ${currency}

— AKO by Lee`;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
      });

      if (customerEmail) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: customerEmail,
          subject: 'AKO by Lee — Order Confirmation',
          text: receipt
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `New Order — ${customerEmail || name}`,
        text: `Session: ${session.id}
Email: ${customerEmail || 'N/A'}
Name: ${name}
Total: $${amountTotal.toFixed(2)} ${currency}

Items:
${list || '(no items?)'}`
      });

      emailedSessions.add(session_id);
    }

    res.json({ ok: true, emailed: true });
  } catch (err) {
    console.error('Confirm-order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- HEALTH ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- CATCH-ALL (no path string → won’t trigger path-to-regexp error) ----------
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/debug')) return next();
  // Send a generic fallback page
  const fallback = fs.existsSync(shopFile) ? shopFile : successFile;
  res.sendFile(fallback, err => {
    if (err) res.status(404).send('No fallback page. Ensure public/success.html exists.');
  });
});

// ---------- START ----------
app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));
