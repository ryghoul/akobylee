require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// --- STATIC ROOT (defaults to ./public next to server.js) ---
const STATIC_DIR = process.env.STATIC_DIR || 'public';
const STATIC_ROOT = path.resolve(__dirname, STATIC_DIR);
console.log('[STATIC ROOT]', STATIC_ROOT);

// quick debug: list files in /public
app.get('/debug/public-list', (_req, res) => {
  let list; try { list = fs.readdirSync(STATIC_ROOT); } catch { list = ['<missing public/>']; }
  res.json({ STATIC_ROOT, list });
});

// CORS + parsers
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://akobylee.onrender.com,http://localhost:3000')
  .split(',').map(s => s.trim());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static FIRST
app.use(express.static(STATIC_ROOT));

// Explicit routes for pages
app.get('/', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'index.html')));
app.get('/shop', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'shop.html')));
app.get('/shop.html', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'shop.html')));

// ----- (optional) Stripe webhook to email confirmations -----
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = stripe.webhooks.constructEvent(req.body, sig, secret);

    if (event.type === 'checkout.session.completed') {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
        expand: ['line_items', 'customer_details']
      });
      const items = session.line_items?.data || [];
      const email = session.customer_details?.email || session.customer_email;
      const name = session.customer_details?.name || 'Customer';
      const total = (session.amount_total || 0) / 100;
      const currency = (session.currency || 'usd').toUpperCase();

      const list = items.map(i => {
        const unit = (i.price?.unit_amount || 0) / 100;
        return `• ${i.description} — ${i.quantity} × $${unit.toFixed(2)}`;
      }).join('\n');

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
      });

      if (email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'AKO by Lee — Order Confirmation',
          text: `Thanks for your order, ${name}!\n\n${list}\n\nTotal: $${total.toFixed(2)} ${currency}\n— AKO by Lee`
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `New Order — ${email || name}`,
        text: `Total: $${total.toFixed(2)} ${currency}\n\nItems:\n${list}`
      });
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Webhook error', e.message);
    res.status(400).send('Webhook error');
  }
});

// ----- Checkout: always return to /shop.html -----
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items = [], customer } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in request.' });
    }
    const line_items = items.map(i => ({
      price_data: { currency: 'usd', product_data: { name: i.name }, unit_amount: i.price },
      quantity: i.quantity,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 }
    }));

    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const returnUrl = `${base}/shop.html`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','JP','DE','FR','MX','SG'] },
      success_url: `${returnUrl}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${returnUrl}?canceled=1`,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe error:', e);
    res.status(500).json({ error: e?.raw?.message || e.message || 'Unable to create checkout session' });
  }
});

// 404 LAST
app.use((req, res) => res.status(404).send('Not Found'));

// Start
app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));
