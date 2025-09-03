// ───────── IMPORTS ─────────
require('dotenv').config();                // load .env variables
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
// You can drop body-parser; express has built-in JSON/urlencoded parsers
// const bodyParser = require('body-parser');

// ✅ UNCOMMENT & INSTALL STRIPE
// npm i stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ───────── INIT APP ─────────
const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));
// ───────── MIDDLEWARE ─────────
app.use(cors({
  origin: [
    'https://akobylee.onrender.com/'  // <-- add your real domain when deployed
  ]
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

// ───────── RESERVATION ROUTE ─────────
app.post('/reserve', async (req, res) => {
  const { name, email, date, time, partySize, notes } = req.body;

  // ⚠️ Consider moving these creds to env vars too
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'napppy.lee@gmail.com', pass: 'prjvtfjoffeaqkpu' }
  });

  const mailOptions = {
    from: email,
    to: 'napppy.lee@gmail.com',
    subject: `New Reservation from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nDate: ${date}\nTime: ${time}\nParty Size: ${partySize}\nNotes: ${notes || "None"}`
  };

  const confirmationMailOptions = {
    from: 'napppy.lee@gmail.com',
    to: email,
    subject: 'AKO Reservation Confirmation',
    text: `Hi ${name},\n\nThanks for reserving with AKO by Lee!\n\n📅 Date: ${date}\n⏰ Time: ${time}\n👥 Guests: ${partySize}\n📝 Notes: ${notes || "None"}\n\n– AKO by Lee Team`
  };

  try {
    await transporter.sendMail(mailOptions);
    await transporter.sendMail(confirmationMailOptions);
    res.status(200).json({ message: 'Reservation submitted and confirmation sent!' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ message: 'Error sending reservation or confirmation.' });
  }
});

// ───────── CONTACT ROUTE ─────────
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'napppy.lee@gmail.com', pass: 'prjvtfjoffeaqkpu' }
  });

  const mailOptions = {
    from: email,
    to: 'napppy.lee@gmail.com',
    subject: `New Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
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

    // (Optional) simple allowlist to avoid price tampering from client
    // const ALLOW = { 'SINESIS HOODIES': 4500, 'TEA SHIRTS': 2500, 'FLOWER BANDANA': 1500, 'STICKY RICE': 800, 'LYCHEE "INFUSED" BLACK TEA': 800 };

    const line_items = items.map(i => {
      // if (!ALLOW[i.name] || i.price > ALLOW[i.name]) throw new Error('Invalid item/price');
      return {
        price_data: {
          currency: 'usd',
          product_data: { name: i.name },
          unit_amount: i.price, // cents
        },
        quantity: i.quantity,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      // If you want Stripe to prefill contact/shipping:
      customer_email: customer?.email,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'JP', 'DE', 'FR', 'MX', 'SG'] },

      success_url: 'http://akobylee.onrender.com/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://akobylee.onrender.com/shop.html',
      // automatic_tax: { enabled: true }, // if configured in Dashboard
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    const msg = err?.raw?.message || err.message || 'Unable to create checkout session';
    return res.status(500).json({ error: msg });
  }
});

// ───────── START SERVER ─────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
