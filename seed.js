import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dapper-coat';

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding');
    await Product.deleteMany({});
    const items = [
      { name: 'مانتو دپر - بنفش', price: 250000, description: 'مانتو مجلسی بنفش روشن', imageUrl: '/image/products/sample1.jpg', category: 'مجلسی', stock: 10 },
      { name: 'مانتو کلاسیک', price: 200000, description: 'مانتو روزمره پارچه نخی', imageUrl: '/image/products/sample2.jpg', category: 'روزمره', stock: 15 },
      { name: 'مانتو کلاسیک', price: 200000, description: 'مانتو روزمره پارچه نخی', imageUrl: '/image/products/sample3.jpg', category: 'روزمره', stock: 10 },
      { name: 'مانتو کلاسیک', price: 200000, description: 'مانتو روزمره پارچه نخی', imageUrl: '/image/products/sample4.jpg', category: 'روزمره', stock: 5 }
    ];
    await Product.insertMany(items);
    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
