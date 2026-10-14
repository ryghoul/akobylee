// models/ShopSection.js
// A shop collection (section): its name, card style and place on the page.
// Products belong to one through Product.section, which holds the key.
const mongoose = require('mongoose');

const ShopSectionSchema = new mongoose.Schema(
  {
    // Stable id products point to, e.g. "shirts". Never changes after creation,
    // so renaming a collection doesn't touch its products.
    key: { type: String, unique: true, index: true, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    // Card layout: "grid" (photo grid, sizes on hover), "row" (wide rows),
    // "tile" (compact colored tiles).
    style: { type: String, enum: ['grid', 'row', 'tile'], default: 'row' },
    // Position on the page, lowest first.
    order: { type: Number, default: 0 },
    // Hidden collections (the Archived one) are never shown to customers.
    hidden: { type: Boolean, default: false },
  },
  { collection: 'shop_sections', timestamps: true }
);

module.exports = mongoose.models.ShopSection || mongoose.model('ShopSection', ShopSectionSchema);
