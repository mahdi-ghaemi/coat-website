// models/Cart.js  (ESM)
import mongoose from "mongoose";

const selectionSchema = new mongoose.Schema({
  color: String,
  packs: { type: Number, default: 0 }
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: String,
  imageUrl: String,
  unitPrice: Number,
  packSize: Number,
  selections: [selectionSchema],
  totalPacks: { type: Number, default: 0 },
  totalUnits: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  // اگر کاربر لاگین داشت: userId را ذخیره کنید، در غیر اینصورت sessionId کافی است
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  sessionId: { type: String, required: true, index: true },
  items: [cartItemSchema],
}, { timestamps: true });

// حذف خودکار بعد از 30 روز از آخرین آپدیت (TTL index)
cartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
