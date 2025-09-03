// ───────── IMPORTS ─────────
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ───────── CHECKS SUCCESS.HTML ─────────
const fs = require('fs');
const staticRoot = path.join(__dirname, 'public');
const successPath = path.join(staticRoot, 'success.html');

console.log('[PUBLIC_BASE_URL]', process.env.PUBLIC_BASE_URL);
console.log('[STATIC ROOT]', staticRoot);
fs.access(successPath, fs.constants.R_OK, (err) => {
  console.log(err ? '[MISSING] public/success.html not readable' : '[OK] public/success.html found');
});



// ───────── APP / CONFIG ─────────
const app = express();
const PORT = process.env.PORT || 3000;

// Your public site base URL (set in Render env):
//   PRODUCTION: PUBLIC_BASE_URL=https://akobylee.onrender.com
//   LOCAL:      PUBLIC_BASE_URL=http://localhost:3000
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// ───────── MIDDLEWARE ─────────
app.use(cors({
  origin: [
    'https://akobylee.onrender.com',
    'http://localhost:3000'
  ]
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ───────── EMAIL (Nodemailer) CONFIG ─────────
// Rotate your app password and keep it in env!
const EMAIL_USER = process.env.EMAIL_USER;           // e.g. napppy.lee@gmail.com
const EMAIL_PASS = process.env.EMAIL_APP_PASSWORD;   // Gmail app password

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
}

// ───────── ROUTES ─────────

// Basic health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve success page via nice route (works even if you change file paths)
app.get('/success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// ───────── RESERVATION ROUTE ─────────
app.post('/reserve', async (req, res) => {
  const { name, email, date, time, partySize, notes } = req.body;

  if (!name || !email || !date || !time || !partySize) {
    return res.status(400).json({ message: 'Missing required reservation fields.' });
  }

  const transporter = makeTransporter();

  const adminMail = {
    from: EMAIL_USER,
    replyTo: email,
    to: EMAIL_USER,
    subject: `New Reservation from ${name}`,
    text: `Name: ${name}
Email: ${email}
Date: ${date}
Time: ${time}
Party Size: ${partySize}
Notes: ${notes || 'None'}`
  };

  const confirmationMail = {
    from: EMAIL_USER,
    to: email,
    subject: 'AKO Reservation Confirmation',
    text: `Hi ${name},

Thanks for reserving with AKO by Lee!

📅 Date: ${date}
⏰ Time: ${time}
👥 Guests: ${partySize}
📝 Notes: ${notes || 'None'}

– AKO by Lee Team`
  };

  try {
    await transporter.sendMail(adminMail);
    await transporter.sendMail(confirmationMail);
    res.status(200).json({ message: 'Reservation submitted and confirmation sent!' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ message: 'Error sending reservation or confirmation.' });
  }
});

// ───────── CONTACT ROUTE ─────────
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Missing required contact fields.' });
  }

  const transporter = makeTransporter();

  const mail = {
    from: EMAIL_USER,
    replyTo: email,
    to: EMAIL_USER,
    subject: `New Message from ${name}`,
    text: `Name: ${name}
Email: ${email}
Message: ${message}`
  };

  try {
    await transporter.sendMail(mail);
    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// ───────── STRIPE CHECKOUT ROUTE ─────────
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items = [], customer } = req.body;

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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'JP', 'DE', 'FR', 'MX', 'SG'] },
      success_url: `${PUBLIC_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`, // or `${PUBLIC_BASE_URL}/success?...`
      cancel_url: `${PUBLIC_BASE_URL}/shop.html`,
      // automatic_tax: { enabled: true },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    const msg = err?.raw?.message || err.message || 'Unable to create checkout session';
    return res.status(500).json({ error: msg });
  }
});

// ───────── START SERVER (single listen) ─────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
