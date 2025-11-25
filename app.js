//mongod --dbpath "D:\ ..."

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "./models/Product.js"
import methodOverride from 'method-override'; 

import session from 'express-session';
import MongoStore from 'connect-mongo';

import Cart from './models/cart.js';

import User from './models/user.js';
import bcrypt from "bcryptjs";

import Order from './models/Order.js';



import axios from 'axios'; 


// برای PDF
import fs from 'fs';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
// برای سازگاری در سرور و لوکال
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// مسیرهای مطمئن
const fontPath = path.join(__dirname, 'fonts', 'Vazirmatn-Regular.ttf');
const logoPath = path.join(__dirname, 'public', 'image', 'logo2.png');



dotenv.config();


const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dapper-coat";


const app = express();
const port = process.env.PORT || 3000;

app.locals.adminMobile = process.env.ADMIN_MOBILE;
app.locals.telegramUsername = process.env.TELEGRAM_USERNAME;
app.locals.whatsappNumber = process.env.WHATSAPP_NUMBER;
app.locals.baleUsername= process.env.BALE_USERNAME;

// body-parser برای فرم‌ها
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({                   //اینجا با app.use() می‌گی که تمام درخواست‌ها از middleware express-session عبور کنن.
  secret: process.env.SESSION_SECRET || 'change_this_secret', //یک رشته‌ی مخفی برای رمزنگاری session ID در cookie است. , معمولاً در .env قرار می‌دیم تا امن باشه: 
  resave: false,                    // اگر مقدار false باشه، session فقط وقتی ذخیره میشه که واقعاً تغییری کرده باشه.
                                    // این باعث کاهش بار روی سرور و دیتابیس میشه.
  saveUninitialized: false, 

  store: MongoStore.create({
    mongoUrl: MONGODB_URI,          // همان اتصال دیتابیس
    collectionName: 'sessions',     // اسم کالکشن در MongoDB
    // ttl: 60 * 60 * 24 * 7,          // مدت نگهداری session (اینجا ۷ روز)
  }),         
                                    
  cookie: { maxAge: 1000 * 60 * 60 * 24*7 } // یک روز. این گزینه برای مدت اعتبار session است.
  //اگر تنها cookie را بگذارید زمان ttl با آن یکی می شود.
}));
//این باعث می‌شود سبد خرید و اطلاعات ورود کاربر حتی بعد از بستن سرور (nodemon restart) هم در دیتابیس باقی بماند



//این کار باعث میشه در تمام فایل‌های .ejs بتونی مستقیماً از user استفاده کنی
app.use(async (req, res, next) => {
  res.locals.user = null;

  // ✅ اگر ادمین است (و در DB نیست)
  if (req.session.isAdmin) {
    res.locals.user = req.session.user || { role: "admin" };
    return next();
  }

  // ✅ اگر کاربر معمولی لاگین کرده
  if (req.session.userId && mongoose.Types.ObjectId.isValid(req.session.userId)) {
    try {
      if (!req.session.user) {
        const user = await User.findById(req.session.userId).lean();
        if (user) req.session.user = user;
      }
      res.locals.user = req.session.user || null;
    } catch (err) {
      console.error("❌ خطا در لود کاربر:", err);
      req.session.user = null;
    }
  }

  next();
});

app.use(methodOverride('_method')); //برای حذف باید از method-override استفاده کنیم چون فرم HTML فقط GET و POST رو ساپورت می‌کنه.


// اتصال به MongoDB و سپس اجرای سرور
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected'); 
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// تنظیم EJS
app.set("view engine", "ejs");

// فایل‌های استاتیک
app.use(express.static("public"));



// helper: برگرداندن/ساختن Cart مربوط به session یا مهاجرت از req.session.cart
async function getOrCreateCartForSession(req) {
  // اگر قبلاً cartId در سشن بود، تلاش کن آن را برگردانی
  if (req.session.cartId) {
    try {
      const cart = await Cart.findById(req.session.cartId);
      if (cart) return cart;
      // اگر cart موجود نبود، حذفش کن تا دوباره ساخته شود
      delete req.session.cartId;
    } catch (e) {
      console.error("getOrCreateCartForSession: findById error", e);
      delete req.session.cartId;
    }
  }

  // اگر سشن قبلاً ساختار قدیمی req.session.cart را داشت -> مهاجرت کن
  if (Array.isArray(req.session.cart) && req.session.cart.length > 0) {
    // تبدیل آیتم‌ها به فرمت مدل
    const itemsFromSession = req.session.cart.map(it => ({
      productId: it.productId,
      name: it.name,
      imageUrl: it.imageUrl,
      unitPrice: it.unitPrice,
      packSize: it.packSize,
      selections: Array.isArray(it.selections) ? it.selections.map(s => ({ color: s.color, packs: s.packs })) : [],
      totalPacks: it.totalPacks || 0,
      totalUnits: it.totalUnits || 0,
      totalPrice: it.totalPrice || 0
    }));

    const cart = new Cart({
      sessionId: req.sessionID,
      items: itemsFromSession
    });
    await cart.save();
    req.session.cartId = cart._id.toString();
    // پاک کن تا سشن دوکاره نشه
    delete req.session.cart;
    return cart;
  }

  // در غیر اینصورت یک سند cart جدید بساز
  const newCart = new Cart({
    sessionId: req.sessionID,
    items: []
  });
  await newCart.save();
  req.session.cartId = newCart._id.toString();
  return newCart;
}



// صفحات سایت
app.get("/", async (req, res) => {
    try {
    // 🔹 آخرین ۶ محصول (جدیدترین‌ها)
    const latestProducts = await Product.find().sort({ createdAt: -1 }).limit(6).lean();

    res.render("home", { latestProducts });
  } catch (err) {
    console.error("❌ خطا در بارگذاری محصولات:", err);
    res.render("home", { latestProducts: [] }); // صفحه اصلی فروشگاه
  }
});


// MongoDBخواندن محصولات از 
app.get("/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }); // جدیدترین‌ها اول
        res.render("products", { products });  // لیست مانتوها از MongoDB
    } catch (err) {
        console.error(err);
        res.status(500).send("خطا در بارگذاری محصولات");
    }
});

// API: اضافه کردن محصول جدید (JSON body)
app.post('/api/products', async (req, res) => {
  try {
    let {
      name, price, description, imageUrl, category, stock, packSize, colors
    } = req.body; // ← تغییر دادیم به let تا قابل ویرایش باشد

    // اگر کاربر در فرم رنگ‌ها را با کاما یا "،" جدا کرده:
    if (typeof colors === 'string') {
      colors = colors
        .split(/[,،]/)     // جدا کردن با کاما یا ویرگول فارسی
        .map(c => c.trim()) // حذف فاصله‌ها
        .filter(c => c.length > 0); // حذف موارد خالی
    }

    // اگر colors آرایه‌ای از رشته‌ها باشد ولی هنوز رشته‌های تو در تو داشته باشد
    if (Array.isArray(colors)) {
      colors = colors.flatMap(c =>
        String(c)
          .split(/[,،]/)
          .map(x => x.trim())
          .filter(Boolean)
      );
    }

    // مسیر تصویر (اختیاری)
    let img = req.body.imageUrl?.trim() || null;
    if (img && !img.startsWith("/image/products/")) {
      img = "/image/products/" + img;
    }

    const product = new Product({
      name,
      price: Number(price || 0),
      description,
      imageUrl: img,
      category,
      stock: Number(stock || 0),
      packSize: Number(packSize || 1),
      colors
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});




// -----------------------------Admin----------------------------------

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login?next=/admin/dashboard');
  }

    const products = await Product.find().lean().sort({ createdAt: -1});
    const users = await User.find().lean().sort({ createdAt: -1});

  res.render('admin/admin-dashboard', { products, users });
});


// 🧩 بررسی ادمین بودن (به‌صورت تابع داخلی)
function isAdmin(req, res, next) {
  if (req.session.isAdmin) return next();

  // در غیر این صورت، برگرد به صفحه ورود با پارامتر next
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  // res.status(403).send("دسترسی غیرمجاز ❌");
}


// صفحهٔ مدیریت ساده برای افزودن محصول (فرم کوچک)
app.get('/admin',isAdmin,(req,res) => {
    res.render('admin');
});

// نمایش همه محصولات در پنل ادمین
app.get('/admin/products', isAdmin ,async (req,res)=>{
    try {
        const products = await Product.find().lean().sort({ createdAt: -1});
        const users = await User.find().lean().sort({ createdAt: -1});

        res.render('admin/admin-dashboard', { products, users });
    } catch (err){
        res.status(500).send(err.message);
    }
});

// برای پاک کردن محصولات در پنل ادمین
app.delete('/admin/products/:id', isAdmin , async(req,res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//گرفتن فرم ویرایش برای یک محصول خاص
app.get('/admin/products/:id/edit', isAdmin , async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.render('edit-product', { product });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


//تغییرات در دیتابیس برای محصول ویرایش شده
app.put('/admin/products/:id', isAdmin , async (req, res) => {
  try {
    const { name, price, description, imageUrl, category, stock, packSize, colors } = req.body;

    // تبدیل رشته رنگ‌ها به آرایه درست
    let colorsArr = [];
    const colorsInput = req.body.colors;
    if (Array.isArray(colorsInput)) {
    colorsArr = colorsInput.map(c => String(c).trim()).filter(Boolean);
    } else if (typeof colorsInput === 'string') {
    // تقسیم با پشتیبانی از ویرگول فارسی و انگلیسی
    colorsArr = colorsInput.split(/[،,]/).map(c => c.trim()).filter(Boolean);
    }

    let img = imageUrl?.trim() || null;
    if (img && !img.startsWith("/image/products/")) {
        img = "/image/products/" + img;
    }

    await Product.findByIdAndUpdate(req.params.id, {
      name,
      price: Number(price || 0),
      description,
      imageUrl: img,
      category,
      stock: Number(stock || 0),
      packSize: Number(packSize || 1),
      colors: colorsArr
    });

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


// ------🧩 مدیریت کاربران (Admin)------


// لیست همه کاربران
app.get('/admin/users', isAdmin, async (req, res) => {
  try {

    const products = await Product.find().lean().sort({ createdAt: -1});
    const users = await User.find().lean().sort({ createdAt: -1});

    res.render('admin/admin-dashboard', { products, users });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در بارگذاری کاربران');
  }
});

// حذف کامل یک کاربر (و سبد/سفارشاتش اگر بخواهی)
app.delete('/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    // حذف کاربر
    await User.findByIdAndDelete(userId);
    // اختیاری: پاک کردن سفارش‌ها و سبدهای آن کاربر
    await Cart.deleteMany({ userId });
    await Order.deleteMany({ userId });

    const products = await Product.find().lean().sort({ createdAt: -1});
    const users = await User.find().lean().sort({ createdAt: -1});

    res.render('admin/admin-dashboard', { products, users });

  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در حذف کاربر');
  }
});

// نمایش جزئیات کاربر و سوابق خرید او
app.get('/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('کاربر پیدا نشد');

    // گرفتن سفارش‌ها و سبدها
    const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 });
    res.render('admin/admin-user-detail', { user, orders });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در بارگذاری اطلاعات کاربر');
  }
});


// نمایش جزئیات یک سفارش خاص (فقط برای ادمین)
app.get('/admin/orders/:orderId', isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('userId');
    if (!order) return res.status(404).send('سفارش پیدا نشد');

    res.render('admin/admin-order-detail', { order });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در بارگذاری جزئیات سفارش');
  }
});


// ✅ تغییر وضعیت سفارش
app.post('/admin/orders/:id/status', isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('سفارش یافت نشد.');
    order.status = req.body.status;
    await order.save();
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در تغییر وضعیت سفارش.');
  }
});

// ✅ حذف سفارش
app.delete('/admin/orders/:id', isAdmin, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.redirect('/admin/users'); // یا هر مسیر اصلی مدیریت سفارشات
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در حذف سفارش.');
  }
});

// بخش درست شدن PDF--------------------

// تابع اصلاح فارسی برای نمایش راست‌چین
function fixFa(text) {
  if (!text) return "";
  text = String(text);
  return text.split(" ").reverse().join(" ");
}

// ✅ چاپ فاکتور PDF با جدول اصلاح شده
app.get('/admin/orders/:id/invoice', isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId');
    if (!order) return res.status(404).send('سفارش یافت نشد.');

    // ایجاد سند PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${order.orderCode}.pdf"`);
    doc.pipe(res);

    // 🖋 فونت فارسی
    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    }

    // 🏷️ لوگو
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 80 });
    }

    // عنوان
    doc.fontSize(20).text(fixFa('فاکتور فروش'), 0, 50, { align: 'center' });
    
    // اطلاعات فروشگاه
    doc.fontSize(11);
    doc.text(fixFa('فروشگاه مانتو داپر (Dapper)'), 50, 90, { align: 'right', width: 500 });
    doc.text(fixFa('تلفن: ۰۹۱۲۳۴۵۶۷۸۹'), 50, 105, { align: 'right', width: 500 });

    // اطلاعات خریدار - کاملاً اصلاح شده
    const userName = `${order.firstName || order.userId?.firstName || ''} ${order.lastName || order.userId?.lastName || ''}`;
    const address = order.address || order.userId?.address || '-';
    const phone = order.userId.mobile || '-';
    const postalCode = order.postalCode || '-';


    const infoY = 140;
    
    // مستطیل اطلاعات خریدار با پس‌زمینه
    doc.rect(40, infoY, 515, 125).fill('#f8f8f8').stroke();
    
    // عنوان بخش اطلاعات خریدار
    doc.fontSize(12).fillColor('#333');
    doc.text(fixFa('اطلاعات خریدار:'), 40-10, infoY + 5, { align: 'right', width: 515 });
    
    // اطلاعات داخل مستطیل - با موقعیت‌های دقیق
    doc.fontSize(10);
    doc.text(fixFa(`نام خریدار: ${userName}`), 40-10, infoY + 22, { align: 'right', width: 515 });
    doc.text(fixFa(`کد سفارش: ${order.orderCode}`), 40-10, infoY + 39, { align: 'right', width: 515 });
    doc.text(fixFa(`تاریخ: ${new Date(order.createdAt).toLocaleString('fa-IR')}`), 40-10, infoY + 56, { align: 'right', width: 515 });
    doc.text(fixFa(`شماره تماس: ${phone}`), 40-10, infoY + 73, { align: 'right', width: 515 });
    doc.text(fixFa(`آدرس: ${address}`), 40-10, infoY + 90, { align: 'right', width: 515 });
    doc.text(fixFa(`کدپستی: ${postalCode}`), 40-10, infoY + 107, { align: 'right', width: 515 });

    // جدول اقلام
    const tableTop = infoY + 135;
    doc.fontSize(14).fillColor('#000').text(fixFa('اقلام سفارش'), 0, tableTop, { align: 'center', underline: true });

    // هدر جدول - با رنگ مشخص
    const headerY = tableTop + 30;
    doc.rect(40, headerY, 515, 25).fill('#e0e0e0').stroke();
    doc.fillColor('#000').fontSize(10);

    // تعریف موقعیت ستون‌ها - از راست به چپ
    const colX = {
      subtotal: 60,      // جمع جزء - سمت راست
      unitPrice: 120,    // قیمت واحد
      totalUnits: 180,   // مجموع تعداد
      packs: 240,        // تعداد بسته
      packSize: 300,     // تعداد در 1 بسته
      color: 360,        // رنگ
      name: 420,         // نام محصول
      row: 530           // ردیف - سمت چپ
    };

    // عرض ستون‌ها
    const colWidth = {
      subtotal: 50,
      unitPrice: 50,
      totalUnits: 50,
      packs: 40,
      packSize: 40,
      color: 50,
      name: 100,
      row: 30
    };

    // عناوین ستون‌ها - از راست به چپ
    doc.fillColor('#000');
    doc.text(fixFa('جمع جزء'), colX.subtotal, headerY + 8, { width: colWidth.subtotal, align: 'left' });
    doc.text(fixFa('قیمت واحد'), colX.unitPrice, headerY + 8, { width: colWidth.unitPrice, align: 'left' });
    doc.text(fixFa('مجموع تعداد'), colX.totalUnits, headerY + 8, { width: colWidth.totalUnits, align: 'left' });
    doc.text(fixFa('تعداد بسته'), colX.packs, headerY + 8, { width: colWidth.packs, align: 'left' });
    doc.text(fixFa('تعداد در 1 بسته'), colX.packSize, headerY + 8, { width: colWidth.packSize, align: 'left' });
    doc.text(fixFa('رنگ'), colX.color, headerY + 8, { width: colWidth.color, align: 'left' });
    doc.text(fixFa('نام محصول'), colX.name, headerY + 8, { width: colWidth.name, align: 'left' });
    doc.text(fixFa('ردیف'), colX.row, headerY + 8, { width: colWidth.row, align: 'center' });

    let currentY = headerY + 30;
    let rowIndex = 0;
    let grandTotal = 0;

    // ردیف‌های جدول
    order.items.forEach((item, itemIndex) => {
      if (item.selections && item.selections.length > 0) {
        // برای هر رنگ یک ردیف جداگانه
        item.selections.forEach((selection, selIndex) => {
          // پس‌زمینه برای ردیف‌ها
          const isEvenRow = rowIndex % 2 === 0;
          if (isEvenRow) {
            doc.rect(40, currentY - 5, 515, 20).fill('#f9f9f9').stroke();
          } else {
            doc.rect(40, currentY - 5, 515, 20).fill('#ffffff').stroke();
          }

          doc.fillColor('#000').fontSize(9);

          // محاسبات
          const totalUnits = selection.packs * (item.packSize || 1);
          const subtotal = totalUnits * (item.unitPrice || 0);
          grandTotal += subtotal;

          // داده‌های ردیف - از راست به چپ
          doc.text(fixFa(`${subtotal.toLocaleString()}`), colX.subtotal, currentY, { width: colWidth.subtotal, align: 'left' });
          doc.text(fixFa(`${(item.unitPrice || 0).toLocaleString()}`), colX.unitPrice, currentY, { width: colWidth.unitPrice, align: 'left' });
          doc.text(fixFa(`${totalUnits}`), colX.totalUnits, currentY, { width: colWidth.totalUnits, align: 'left' });
          doc.text(fixFa(`${selection.packs || 0}`), colX.packs, currentY, { width: colWidth.packs, align: 'left' });
          doc.text(fixFa(`${item.packSize || 1}`), colX.packSize, currentY, { width: colWidth.packSize, align: 'left' });
          doc.text(fixFa(selection.color || '-'), colX.color, currentY, { width: colWidth.color, align: 'left' });
          doc.text(fixFa(item.name), colX.name, currentY, { width: colWidth.name, align: 'left' });
          doc.text(fixFa(`${rowIndex + 1}`), colX.row, currentY, { width: colWidth.row, align: 'center' });

          currentY += 20;
          rowIndex++;

          // بررسی اگر صفحه پر شده
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
            
            // رسم هدر جدول در صفحه جدید
            doc.rect(40, currentY, 515, 25).fill('#e0e0e0').stroke();
            doc.fillColor('#000').fontSize(10);
            doc.text(fixFa('جمع جزء'), colX.subtotal, currentY + 8, { width: colWidth.subtotal, align: 'left' });
            doc.text(fixFa('قیمت واحد'), colX.unitPrice, currentY + 8, { width: colWidth.unitPrice, align: 'left' });
            doc.text(fixFa('مجموع تعداد'), colX.totalUnits, currentY + 8, { width: colWidth.totalUnits, align: 'left' });
            doc.text(fixFa('تعداد بسته'), colX.packs, currentY + 8, { width: colWidth.packs, align: 'left' });
            doc.text(fixFa('تعداد در 1 بسته'), colX.packSize, currentY + 8, { width: colWidth.packSize, align: 'left' });
            doc.text(fixFa('رنگ'), colX.color, currentY + 8, { width: colWidth.color, align: 'left' });
            doc.text(fixFa('نام محصول'), colX.name, currentY + 8, { width: colWidth.name, align: 'left' });
            doc.text(fixFa('ردیف'), colX.row, currentY + 8, { width: colWidth.row, align: 'center' });
            currentY += 30;
          }
        });
      } else {
        // اگر انتخابی وجود ندارد
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          doc.rect(40, currentY - 5, 515, 20).fill('#f9f9f9').stroke();
        } else {
          doc.rect(40, currentY - 5, 515, 20).fill('#ffffff').stroke();
        }

        doc.fillColor('#000').fontSize(9);
        
        const totalUnits = (item.quantity || 0) * (item.packSize || 1);
        const subtotal = totalUnits * (item.unitPrice || 0);
        grandTotal += subtotal;

        // داده‌های ردیف - از راست به چپ
        doc.text(fixFa(`${subtotal.toLocaleString()}`), colX.subtotal, currentY, { width: colWidth.subtotal, align: 'left' });
        doc.text(fixFa(`${(item.unitPrice || 0).toLocaleString()}`), colX.unitPrice, currentY, { width: colWidth.unitPrice, align: 'left' });
        doc.text(fixFa(`${totalUnits}`), colX.totalUnits, currentY, { width: colWidth.totalUnits, align: 'left' });
        doc.text(fixFa(`${item.quantity || 0}`), colX.packs, currentY, { width: colWidth.packs, align: 'left' });
        doc.text(fixFa(`${item.packSize || 1}`), colX.packSize, currentY, { width: colWidth.packSize, align: 'left' });
        doc.text(fixFa('-'), colX.color, currentY, { width: colWidth.color, align: 'left' });
        doc.text(fixFa(item.name), colX.name, currentY, { width: colWidth.name, align: 'left' });
        doc.text(fixFa(`${rowIndex + 1}`), colX.row, currentY, { width: colWidth.row, align: 'center' });

        currentY += 20;
        rowIndex++;
      }
    });

    // خط پایانی جدول
    doc.moveTo(40, currentY).lineTo(555, currentY).stroke();

    // جمع کل - در انتها
    currentY += 15;
    doc.fontSize(12).fillColor('#000')
       .text(fixFa(`جمع کل: ${grandTotal.toLocaleString()} تومان`), 
             colX.subtotal-3, currentY, { width: colWidth.subtotal + 100, align: 'left' });

    // پایان
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در تولید فاکتور.');
  }
});
// -----------------------------Admin----------------------------------







// برای نشان دادن جزئیات محصول
app.get('/products/:id', async (req,res) =>{
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send("محصولی پیدا نشد");
        }
        console.log('product.colors (from DB):', product.colors);
        res.render('product-detail', {product});
    } catch (err) {
        res.status(500).send(err.message);
    }
});



//  برای نشان دادن جزئیات محصول برای نسخه DB
app.post('/cart/add/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send("محصول پیدا نشد");

    // دریافت آرایه‌ها (بدون فرض اینکه همیشه آرایه هستند)
    let colorsArr = req.body['colors[]'] || req.body.colors || [];
    let packsArr = req.body['packs[]'] || req.body.packs || [];

    if (!Array.isArray(colorsArr)) colorsArr = [colorsArr].filter(Boolean);
    if (!Array.isArray(packsArr)) packsArr = [packsArr].filter(Boolean);

    // زوج‌سازی براساس ایندکس
    const selections = [];
    for (let i = 0; i < colorsArr.length; i++) {
      const color = String(colorsArr[i] || '').trim();
      const packs = parseInt(packsArr[i]) || 0;
      if (color && packs > 0) {
        selections.push({ color, packs });
      }
    }

    if (selections.length === 0) {
      return res.status(400).send("لطفاً حداقل یک رنگ را با تعداد بستهٔ مثبت انتخاب کنید.");
    }

    // استفاده از helper برای گرفتن یا ساختن Cart در DB
    const cart = await getOrCreateCartForSession(req);

    // برای هر selection آنچه در session انجام می‌دادیم — اینجا روی سند DB انجام می‌دهیم
    for (let sel of selections) {
      // آیا برای همین محصول آیتمی وجود دارد؟
      const existingItem = cart.items.find(it => it.productId.toString() === product._id.toString());

      if (existingItem) {
        // آیا همین رنگ وجود دارد؟
        const existingSel = existingItem.selections.find(s => s.color === sel.color);
        if (existingSel) {
          existingSel.packs += sel.packs;
        } else {
          existingItem.selections.push({ color: sel.color, packs: sel.packs });
        }
        // بروزرسانی محاسبات آیتم
        existingItem.totalPacks = existingItem.selections.reduce((s, it) => s + it.packs, 0);
        existingItem.totalUnits = existingItem.totalPacks * (existingItem.packSize || product.packSize || 1);
        existingItem.totalPrice = existingItem.totalUnits * (existingItem.unitPrice || product.price || 0);
      } else {
        // آیتم جدید اضافه کن
        const newItem = {
          productId: product._id,
          name: product.name,
          imageUrl: product.imageUrl,
          unitPrice: Number(product.price || 0),
          packSize: Number(product.packSize || 1),
          selections: [{ color: sel.color, packs: sel.packs }],
        };
        newItem.totalPacks = sel.packs;
        newItem.totalUnits = sel.packs * (newItem.packSize || 1);
        newItem.totalPrice = newItem.totalUnits * newItem.unitPrice;
        cart.items.push(newItem);
      }
    }
    // محاسبه جمع کل سبد
    cart.markModified('items');
    cart.updatedAt = new Date();
    cart.validateSync && cart.validateSync();
    await cart.save();

    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


// بالا آوردن /cart با پاس دادن cart درست شده برای حالت DB
app.get('/cart', async (req, res) => {
  try {
    const cart = await getOrCreateCartForSession(req);
    // برای هماهنگی با قالب فعلی که انتظار یک آرایه دارد:
    res.render('cart', { cart: cart.items || [] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


// برای حذف آیتم بر اساس ایندکس از صفحه سبد خرید برای نسخه DB
app.post('/cart/remove/:index', async (req, res) => {
  try {
    const idx = Number(req.params.index);
    const cart = await getOrCreateCartForSession(req);      //اگر سبد در MongoDB برای این سشن موجود باشد → آن را برمی‌گرداند.
                                                            //اگر نباشد → یک سبد خالی جدید می‌سازد.
    if (!isNaN(idx) && cart.items && cart.items.length > idx) {     //بررسی می‌کند که:
                                                                    //idx واقعاً یک عدد است،
                                                                    //آرایه‌ی cart.items وجود دارد،
                                                                  
                                                                    //و آن اندیس در محدوده‌ی طول آرایه است.
      cart.items.splice(idx, 1);                            // اگر همه درست بود → با splice() آیتم را از آرایه حذف می‌کند
      // محاسبه جدید جمع کل (اختیاری اگر در قالب از totalPrice استفاده بشه)
      //ثبت تغییر در Mongoose
      cart.markModified('items');   //markModified('items') به Mongoose می‌گوید که فیلد items تغییر کرده، پس باید آن را ذخیره کند.
      cart.updatedAt = new Date();  //updatedAt هم برای بروزرسانی زمان آخرین تغییر است.
      await cart.save();            // تغییر در دیتابیس ذخیره می‌شود
    }
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


// ثبت‌نام
app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, mobile, password, email, address, postalCode } = req.body;
    const existing = await User.findOne({ mobile });
    if (existing) return res.send("این شماره موبایل قبلاً ثبت شده است.");

    const user = new User({ firstName, lastName, mobile, password, email, address, postalCode });
    await user.save();
    req.session.userId = user._id;
    // res.redirect("/");
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    res.status(500).send("خطا در ثبت‌نام");
  }
});

// ورود
app.get("/login", (req, res) => {
  res.render("login", { next: req.query.next });  // ← اینجا next از query گرفته می‌شود
});


// بررسی نام کاربری و پسورد
app.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;
    const nextUrl = req.body.next || "/";  // ← اینجا next از فرم گرفته می‌شود

    // 🧩 بررسی ادمین از env
    if (
      mobile === process.env.ADMIN_MOBILE &&
      password === process.env.ADMIN_PASSWORD
    // ) {
    //   req.session.userId = "admin"; // شناسه ثابت برای ادمین
    //   req.session.isAdmin = true;
    //   return res.redirect("/admin/dashboard");
    // }
    ) {
      req.session.userId = null;       // چون در DB نیست
      req.session.isAdmin = true;      // علامت ادمین
      req.session.user = {             // اطلاعات نمایشی ادمین
        firstName: "مدیر",
        lastName: "",
        role: "admin",
        mobile,
      };
      return res.redirect("/admin/dashboard");
    
    }
    // 🧩 بقیه کاربران از دیتابیس
    const user = await User.findOne({ mobile });
    if (!user) return res.send("شماره موبایل یا رمز عبور اشتباه است.");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.send("شماره موبایل یا رمز عبور اشتباه است.");

    req.session.userId = user._id;
    req.session.isAdmin = false;

  // ✅ بعد از ورود، اگر next داشت به همان برگرد
    if (nextUrl && nextUrl !== "/login") {
      return res.redirect(nextUrl);
    }


  } catch (err) {
    console.error(err);
    res.status(500).send("خطا در ورود");
  }
});

// خروج
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});



 //صفحه ورود/ثبت‌نام در ادامه خرید 

// ✅ نمایش صفحه checkout
app.get('/checkout', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login?next=/checkout');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login?next=/checkout');

    // فقط اطلاعات کاربر را می‌فرستیم (سبد خرید در این مرحله لازم نیست)
    res.render('checkout', { user });
  } catch (err) {
    console.error('❌ خطا در GET /checkout:', err);
    res.status(500).send('خطا در بارگذاری صفحه تسویه حساب');
  }
});


// پردازش فرم checkout — آپدیت اطلاعات کاربر و هدایت به confirm-order
app.post('/checkout', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login?next=/checkout');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login?next=/checkout');

    const { firstName, lastName, mobile, address, postalCode } = req.body;


    // 👇 به‌روزرسانی اطلاعات کاربر
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.mobile = mobile || user.mobile;
    user.address = address || user.address;
    user.postalCode = postalCode || user.postalCode;

    await user.save(); // ✅ ذخیره در دیتابیس


    res.redirect('/confirm-order');
  } catch (err) {
    console.error('❌ خطا در POST /checkout:', err);
    res.status(500).send('خطا در ذخیره اطلاعات کاربر');
  }
});

// به‌روزرسانی تعداد بسته‌های یک رنگ خاص از یک محصول در سبد خرید برای نسخه DB
app.post('/cart/update/:index/:selIndex', async (req, res) => { //:index → شماره (ایندکس) محصول در آرایه cart.items
                                                                //:selIndex → شماره رنگ انتخاب‌شده در آرایه item.selections
  try {
    const idx = Number(req.params.index);            //شماره محصول در سبد خرید
    const selIdx = Number(req.params.selIndex);      //شماره رنگ در آن محصول
    const newPacks = Number(req.body.packs);         //تعداد جدید بسته‌ها (از فرم یا AJAX)
    //آیا داده‌ها معتبرند
    if (isNaN(idx) || isNaN(selIdx) || isNaN(newPacks) || newPacks <= 0) {      //اگر معتبر نباشند،
      return res.status(400).json({ success: false, message: 'داده نامعتبر است' });
    }

    const cart = await getOrCreateCartForSession(req);  //گرفتن سبد خرید از پایگاه‌داده
                                        //این تابع  تضمین می‌کند که یک سند سبد خرید (Cart) مخصوص این کاربر یا جلسه وجود دارد.
                                        //اگر نبود، می‌سازد.
    //پیدا کردن آیتم و رنگ مربوطه
    const item = cart.items[idx];
    if (!item || !item.selections || !item.selections[selIdx]) {
      return res.status(400).json({ success: false, message: 'آیتم پیدا نشد' });//اگر آیتم یا رنگ مورد نظر وجود نداشته باشد، خطا برمی‌گرداند.
    }

    //تغییر تعداد بسته‌ها
    item.selections[selIdx].packs = newPacks;

    // بروزرسانی مقادیر آیتم
    item.totalPacks = item.selections.reduce((s, sIt) => s + sIt.packs, 0); //جمع کل بسته‌های تمام رنگ‌ها
//توضیح بیشتر
//item.selections چیست؟
//در این سیستم، هر آیتم از سبد خرید می‌تواند چند رنگ مختلف از یک محصول داشته باشد.
//مثلاً:
// item.selections = [
//   { color: 'قرمز', packs: 2 },
//   { color: 'آبی', packs: 3 },
//   { color: 'مشکی', packs: 1 }
// ];
//ما می‌خواهیم جمع کل بسته‌ها را به‌دست آوریم:
//۲ + ۳ + ۱ = ۶
//reduce روی آرایه اجرا می‌شود و یک مقدار نهایی برمی‌گرداند.
//در هر مرحله، نتیجه‌ی جمع تا الان (Accumulator) را در متغیر s نگه می‌دارد
//و عنصر جاری آرایه (sIt) را بررسی می‌کند.
// item.selections.reduce(
//   (s, sIt) => s + sIt.packs, 
//   0
// );
//s → جمع فعلی (در ابتدا برابر با ۰ است چون مقدار دوم reduce عدد صفر است)
// sIt → هر آبجکت از آرایه‌ی selections
// sIt.packs → تعداد بسته در آن رنگ
// در هر بار اجرا:
// s = 0 + 2 → ۲
// s = 2 + 3 → ۵
// s = 5 + 1 → ۶
// در پایان:
//item.totalPacks = 6
//معادل است با:
// let total = 0;
// for (let sIt of item.selections) {
//   total += sIt.packs;
// }
// item.totalPacks = total;

    item.totalUnits = item.totalPacks * (item.packSize || 1);               //تعداد کل واحدها (مثلاً 3 بسته × 6 عدد = 18 عدد)
    item.totalPrice = item.totalUnits * (item.unitPrice || 0);              //کل قیمت آیتم (مثلاً 18 × 50,000 = 900,000 تومان)

    //ذخیره در پایگاه‌داده
    cart.markModified('items');
    cart.updatedAt = new Date();
    await cart.save();
    //محاسبه جمع کل سبد (grandTotal)
    const grandTotal = cart.items.reduce((s, it) => s + (it.totalPrice || 0), 0);
    //خروجی JSON برای آپدیت لحظه‌ای صفحه
    return res.json({
      success: true,
      itemTotalPrice: item.totalPrice,
      grandTotal,
      selections: item.selections.map(s => ({ color: s.color, packs: s.packs })),
      packSize: item.packSize,
      totalUnits: item.totalUnits
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// GET /confirm-order — نمایش صفحه تأیید سفارش با جزئیات کامل از DB
app.get('/confirm-order', async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect('/login?next=/confirm-order');

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login?next=/confirm-order');

    const cart = await getOrCreateCartForSession(req); // سند Cart از MongoDB

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    // ساخت آرایه‌ی detailedItems با جزئیات کامل برای هر آیتم
    const detailedItems = [];
    let total = 0;

    for (const it of cart.items) {
      // بارگذاری محصول از کالکشن Product
      const product = await Product.findById(it.productId);

      // اگر محصول حذف شده باشد، آن آیتم را نادیده بگیر
      if (!product) continue;

      // واحد قیمت از آیتم در سند cart یا از محصول (fallback)
      const unitPrice = Number(it.unitPrice ?? product.price ?? 0);
      const packSize = Number(it.packSize ?? product.packSize ?? 1);

      // آماده‌سازی لیست انتخاب‌های رنگی (selections)
      const selectionsDetail = (Array.isArray(it.selections) ? it.selections : []).map(sel => {
        const packs = Number(sel.packs || 0);
        const units = packs * packSize;
        const subtotal = units * unitPrice;
        return {
          color: sel.color,
          packs,
          units,
          subtotal
        };
      });

      // جمع کل برای این آیتم (اگر در سند محاسبه نشده بود، همینجا حساب می‌کنیم)
      const itemTotalPrice = selectionsDetail.reduce((s, x) => s + (x.subtotal || 0), 0);
      const itemTotalPacks = selectionsDetail.reduce((s, x) => s + (x.packs || 0), 0);
      const itemTotalUnits = selectionsDetail.reduce((s, x) => s + (x.units || 0), 0);

      detailedItems.push({
        productId: product._id,
        name: product.name,
        imageUrl: product.imageUrl || '',
        unitPrice,
        packSize,
        selections: selectionsDetail,
        totalPacks: itemTotalPacks,
        totalUnits: itemTotalUnits,
        totalPrice: itemTotalPrice
      });

      total += itemTotalPrice;
    }

    // در صورتی که هیچ آیتم معتبری نداشتیم، ریدایرکت به سبد
    if (detailedItems.length === 0) return res.redirect('/cart');

    // ارسال به قالب
    res.render('confirm-order', {
      user,
      cart: {
        items: detailedItems,
        total
      }
    });

  } catch (err) {
    console.error('❌ خطا در GET /confirm-order:', err);
    res.status(500).send('خطا در بارگذاری صفحه تأیید سفارش');
  }
});



// -----------------------------
// ✅ ثبت نهایی سفارش (confirm-order)
app.post('/confirm-order', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.userId);
    const cart = await Cart.findOne({ sessionId: req.session.id });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    // 🧮 ساخت آرایه‌ی items با محاسبه دقیق برای هر رنگ
    const orderItems = cart.items.map(it => {
      const packSize = it.packSize || 1;
      const unitPrice = it.unitPrice || 0;

      const selections = (it.selections || []).map(sel => {
        const packs = sel.packs || 0;
        const units = packs * packSize;
        const subtotal = units * unitPrice;
        return {
          color: sel.color,
          colorCode: sel.colorCode,
          packs,
          units,
          subtotal
        };
      });

      const totalPacks = selections.reduce((sum, s) => sum + s.packs, 0);
      const totalUnits = selections.reduce((sum, s) => sum + s.units, 0);
      const totalPrice = selections.reduce((sum, s) => sum + s.subtotal, 0);

      return {
        productId: it.productId,
        name: it.name,
        imageUrl: it.imageUrl,
        unitPrice,
        packSize,
        selections,
        totalPacks,
        totalUnits,
        totalPrice
      };
    });

    // 🧾 محاسبه جمع کل سفارش
    const total = orderItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

    // ساخت کد سفارش یکتا
    const orderCode = 'ORD-' + Date.now();

    // ✅ ایجاد سفارش در دیتابیس
    const order = new Order({
      userId: user._id,
      firstName: user.firstName,   // اضافه شود
      lastName: user.lastName,     // اضافه شود
      //mobile: user.mobile,         // بهتر است شماره موبایل هم ذخیره شود
      items: orderItems,
      total,
      address: user.address,
      postalCode: user.postalCode,
      orderCode,
      createdAt: new Date(),
      status: 'در انتظار پرداخت'
    });

    await order.save();

    // 🧹 خالی کردن سبد پس از ثبت سفارش
    cart.items = [];
    await cart.save();

    // ✅ ارسال پیام به تلگرام و بله
    const orderMessage = `
🛍 سفارش جدید ثبت شد!

👤 مشتری: ${user.firstName} ${user.lastName}
📞 تلفن: ${user.mobile}
🏠 آدرس: ${user.address || '—'}
📮 کدپستی: ${user.postalCode || '—'}

🧾 شماره سفارش: ${order.orderCode}
💰 مبلغ کل: ${order.total.toLocaleString()} تومان

📦 جزئیات سفارش:
${order.items.map(item => `
🔹 ${item.name}
   💰 قیمت واحد: ${item.unitPrice.toLocaleString()} تومان
   📦 هر بسته: ${item.packSize} عدد
   👕 رنگ‌ها:
   ${item.selections.map(sel => `▫️ ${sel.color} — ${sel.packs} بسته (${sel.units} عدد) → ${sel.subtotal.toLocaleString()} تومان`).join('\n   ')}
   💵 جمع جزء: ${item.totalPrice.toLocaleString()} تومان
`).join('\n')}
`;

    // ارسال به تلگرام
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.ADMIN_CHAT_ID,
      text: orderMessage
    });

    // ارسال به بله
    await axios.post(`https://tapi.bale.ai/bot${process.env.BALE_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.BALE_ADMIN_CHAT_ID,
      text: orderMessage
    });

    res.render('order-success', { order, user });

  } catch (err) {
    console.error("❌ خطا در /confirm-order:", err);
    res.status(500).send('خطا در ثبت سفارش');
  }
});



// صفحه حساب من
app.get('/account', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login?next=/account');
  }

  const user = await User.findById(req.session.userId);
  const orders = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 });

  res.render('account', { user, orders });
});

// به روزرسانی در حساب کاربری
app.post('/account/update', async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect('/login');

    const { firstName, lastName, email, address, postalCode } = req.body;

    await User.findByIdAndUpdate(req.session.userId, {
      firstName,
      lastName,
      email,
      address,
      postalCode
    });

    res.redirect('/account');
  } catch (err) {
    console.error('❌ خطا در بروزرسانی اطلاعات:', err);
    res.status(500).send('خطا در بروزرسانی اطلاعات');
  }
});

// مشاهده جرئیات سفارش در حساب شخصی
app.get('/orders/:id', async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect('/login');

    let order = await Order.findOne({
      _id: req.params.id,
      userId: req.session.userId
    }).populate('userId');

    if (!order) return res.status(404).send('سفارش یافت نشد');

    // 🟢 اگر subtotal یا packs یا units محاسبه نشده باشند
    order.items.forEach(item => {
      if (item.selections) {
        item.selections.forEach(sel => {
          if (!sel.subtotal)
            sel.subtotal = (sel.unitPrice || 0) * (sel.units || 1);
        });
      }
    });

    res.render('order-detail', { order });
  } catch (err) {
    console.error('❌ خطا در /orders/:id:', err);
    res.status(500).send('خطا در نمایش جزئیات سفارش');
  }
});


// خروج از حساب کاربری
app.post('/logout', (req, res) => {
  // حذف اطلاعات کاربر از سشن
  req.session.destroy(err => {
    if (err) {
      console.error('خطا در خروج:', err);
      return res.redirect('/');
    }

    // حذف کوکی سشن از مرورگر
    res.clearCookie('connect.sid');

    // هدایت به صفحه اصلی یا ورود
    res.redirect('/login');
  });
});


app.get('/contact', (req, res) => {
  res.render('contact');
});
// پردازش ارسال فرم
app.post('/contact', async (req, res) => {
  const { name, phone, message } = req.body;
  const text = `📩 پیام جدید از فرم تماس:\n\n👤 نام: ${name}\n📱 شماره: ${phone}\n💬 پیام:\n${message}`;

  try {
    // 📤 ارسال به تلگرام
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.ADMIN_CHAT_ID,
      text
    });

    // 📤 ارسال به بله
    await axios.post(`https://tapi.bale.ai/bot${process.env.BALE_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.BALE_ADMIN_CHAT_ID,
      text
    });

    // res.send('<h3 style="text-align:center;margin-top:50px;">✅ پیام شما با موفقیت ارسال شد!</h3>');
    // ✅ پیام موفقیت + هدایت خودکار به صفحه اصلی
    res.send(`
      <div style="text-align:center;margin-top:50px;font-family:sans-serif;">
        <h3>✅ پیام شما با موفقیت ارسال شد!</h3>
        <p>در حال بازگشت به صفحه اصلی...</p>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "/";
        }, 3000);
      </script>
    `);

  } catch (err) {
    console.error('❌ خطا در ارسال پیام:', err);
    // res.send('<h3 style="text-align:center;margin-top:50px;">⚠️ خطا در ارسال پیام، لطفاً دوباره تلاش کنید.</h3>');
    res.send(`
      <div style="text-align:center;margin-top:50px;font-family:sans-serif;">
        <h3>⚠️ خطا در ارسال پیام، لطفاً دوباره تلاش کنید.</h3>
        <p>در حال بازگشت...</p>
      </div>
      <script>
        setTimeout(() => {
          window.history.back();
        }, 3000);
      </script>
    `);
  }
});


