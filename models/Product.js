import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true }, // قیمت هر واحد (تومان)
  description: { type: String },
  imageUrl: { type: String },
  category: { type: String },
  stock: { type: Number, default: 0 },
  packSize: { type: Number, required: true, default: 1 },  // تعداد در هر بسته
  colors: { type: [String], default: [] } // مثلا ["مشکی", "سفید", "قرمز", "آبی"]
}, { timestamps: true }); // createdAt, updatedAt خودکار

const Product = mongoose.model('Product', productSchema);

export default Product;


