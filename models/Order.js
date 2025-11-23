import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: String,
  lastName: String,
  //mobile: String,
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: String,
      imageUrl: String,
      unitPrice: Number,
      quantity: Number,
      packSize: Number,
      totalPrice: Number,
      totalPacks: Number,
      selections: [
        {
          color: String,
          colorCode: String,
          packs: Number,
          units: Number,
          subtotal: Number
        }
      ]
    }
  ],
  total: Number,
  address: String,
  postalCode: String,
  orderCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'در انتظار پرداخت' }
});


const Order = mongoose.model('Order', orderSchema);
export default Order;