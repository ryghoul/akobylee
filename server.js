// server.js (finalized)
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// --- sanity logs so you can see this in Render logs ---
const staticRoot = path.join(__dirname, 'public');
const successPath = path.join(staticRoot, 'success.html');
console.log('[PUBLIC_BASE_URL]', process.env.PUBLIC_BASE_URL);
console.log('[STATIC ROOT]', staticRoot);
fs.access(successPath, fs.constants.R_OK, (err) => {
  console.log(err ? '[MISSING] public/success.html NOT FOUND' : '[OK] public/success.html FOUND');
});

// --- middleware ---
app.use(cors({
  origin: ['https://akobylee.onrender.com', 'http://localhost:3000']
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static files FIRST
app.use(express.static(staticRoot));

// Nice routes to the static files (belt & suspenders)
app.get('/success', (_req, res) => res.sendFile(successPath));
app.get('/success.html', (_req, res) => res.sendFile(successPath));
app.get('/shop', (_req, res) => res.sendFile(path.join(staticRoot, 'shop.html')));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// ----------------- EMAIL HELPERS -----------------
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const makeTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD }
});

// ----------------- YOUR ROUTES -------------------
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
      text: `Name: ${name}\nEmail: ${email}\nDate: ${date}\nTime: ${time}\nParty Size: ${partySize}\nNotes: ${notes || 'None'}`
    });
    await t.sendMail({
      from: EMAIL_USER, to: email, subject: 'AKO Reservation Confirmation',
      text: `Hi ${name},\n\nThanks for reserving with AKO by Lee!\n\n📅 ${date}\n⏰ ${time}\n👥 ${partySize}\n📝 ${notes || 'None'}\n\n– AKO by Lee Team`
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
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    });
    res.json({ message: 'Message sent successfully!' });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

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

    const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','JP','DE','FR','MX','SG'] },
      success_url: `${PUBLIC_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${PUBLIC_BASE_URL}/shop.html`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe error:', e);
    res.status(500).json({ error: e?.raw?.message || e.message || 'Unable to create checkout session' });
  }
});

// Put ANY 404 handler LAST, after static + routes
app.use((req, res) => res.status(404).send('Not Found'));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
