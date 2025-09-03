// ───────── IMPORTS ─────────
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ───────── CONFIG ─────────
const STATIC_ROOT = path.join(__dirname, 'public');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://akobylee.onrender.com,http://localhost:3000')
  .split(',').map(s => s.trim());

// Email creds (use Gmail App Password or SMTP you prefer)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD }
  });
}

// ───────── WEBHOOK (must use raw body & be BEFORE express.json) ─────────
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // set this in Render

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Pull full details for line items & customer
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'customer_details']
      });

      const items = fullSession.line_items?.data || [];
      const customerEmail = fullSession.customer_details?.email || session.customer_email;
      const name = fullSession.customer_details?.name || 'Customer';
      const amountTotal = (fullSession.amount_total ?? 0) / 100;
      const currency = (fullSession.currency || 'usd').toUpperCase();

      // Build a simple text receipt
      const list = items.map(i => {
        const unit = (i.price?.unit_amount ?? 0) / 100;
        return `• ${i.description} — ${i.quantity} × $${unit.toFixed(2)}`;
      }).join('\n');

      const receiptText =
`Thanks for your order, ${name}!

Order Summary
${list || '(no items?)'}

Total: $${amountTotal.toFixed(2)} ${currency}

We’ll email you if there are any updates.
— AKO by Lee`;

      const transporter = makeTransporter();

      // Send to customer (if we have an email)
      if (customerEmail) {
        await transporter.sendMail({
          from: EMAIL_USER,
          to: customerEmail,
          subject: 'AKO by Lee — Order Confirmation',
          text: receiptText
        });
      }

      // Send to admin
      await transporter.sendMail({
        from: EMAIL_USER,
        to: EMAIL_USER,
        subject: `New Order — ${customerEmail || name}`,
        text:
`Checkout Session: ${session.id}
Email: ${customerEmail || 'N/A'}
Name: ${name}
Total: $${amountTotal.toFixed(2)} ${currency}

Items:
${list || '(no items?)'}`
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('Webhook handler failed');
  }
});

// ───────── MIDDLEWARE (after webhook) ─────────
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(STATIC_ROOT));

// Explicit routes for your pages
app.get('/', (_req, res) =>
  res.sendFile(path.join(STATIC_ROOT, 'index.html'))
);

app.get('/shop', (_req, res) =>
  res.sendFile(path.join(STATIC_ROOT, 'shop.html'))
);

app.get('/shop.html', (_req, res) =>
  res.sendFile(path.join(STATIC_ROOT, 'shop.html'))
);

// (keep your /health, /stripe/webhook, etc.)

// Optional health/debug
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/debug/public-list', (_req, res) => {
  let list; try { list = fs.readdirSync(STATIC_ROOT); } catch { list = ['<missing public/>']; }
  res.json({ STATIC_ROOT, list });
});

// ───────── CONTACT / RESERVATION ─────────
app.post('/reserve', async (req, res) => {
  const { name, email, date, time, partySize, notes } = req.body || {};
  if (!name || !email || !date || !time || !partySize) {
    return res.status(400).json({ message: 'Missing required reservation fields.' });
  }
  try {
    const t = makeTransporter();
    await t.sendMail({
      from: EMAIL_USER, replyTo: email, to: EMAIL_USER,
      subject: `New Reservation from ${name}`,
      text: `Name: ${name}
Email: ${email}
Date: ${date}
Time: ${time}
Party Size: ${partySize}
Notes: ${notes || 'None'}`
    });
    await t.sendMail({
      from: EMAIL_USER, to: email, subject: 'AKO Reservation Confirmation',
      text: `Hi ${name},

Thanks for reserving with AKO by Lee!

📅 ${date}
⏰ ${time}
👥 ${partySize}
📝 ${notes || 'None'}

— AKO by Lee Team`
    });
    res.json({ message: 'Reservation submitted and confirmation sent!' });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ message: 'Email error.' });
  }
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Missing required contact fields.' });
  }
  try {
    const t = makeTransporter();
    await t.sendMail({
      from: EMAIL_USER, replyTo: email, to: EMAIL_USER,
      subject: `New Message from ${name}`,
      text: `Name: ${name}
Email: ${email}
Message: ${message}`
    });
    res.json({ message: 'Message sent successfully!' });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// ───────── STRIPE CHECKOUT ─────────
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items = [], customer } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in request.' });
    }

    const line_items = items.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: i.name },
        unit_amount: i.price, // cents
      },
      quantity: i.quantity,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
    }));

    // Redirect back to the shop for both success and cancel
    const returnUrl = `${PUBLIC_BASE_URL}/shop.html`;
    console.log('[CHECKOUT URLS]', { returnUrl });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','JP','DE','FR','MX','SG'] },
      success_url: returnUrl + '?paid=1&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  returnUrl + '?canceled=1',
      // automatic_tax: { enabled: true },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err?.raw?.message || err.message || 'Unable to create checkout session' });
  }
});

// 404 LAST
app.use((req, res) => res.status(404).send('Not Found'));

// ───────── START ─────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${PORT}`);
});
