// Persistent idempotency guard for post-checkout side effects.
const mongoose = require('mongoose');

const OrderEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true, index: true, required: true },
    decrementClaimedAt: { type: Date, default: null },
    decrementedAt: { type: Date, default: null },
    customerEmailClaimedAt: { type: Date, default: null },
    customerEmailedAt: { type: Date, default: null },
    internalEmailClaimedAt: { type: Date, default: null },
    internalEmailedAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },
    // Skus whose stock this order has already taken (so a retry skips them).
    decrementedSkus: { type: [String], default: undefined },
    // Items that ran out between checkout and payment (set by fulfillment).
    stockShortages: {
      type: [{ _id: false, sku: String, requested: Number, available: Number }],
      default: undefined,
    },
  },
  { collection: 'order_events', timestamps: true }
);

module.exports = mongoose.models.OrderEvent || mongoose.model('OrderEvent', OrderEventSchema);
