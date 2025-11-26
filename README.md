🧥 Coat Website

یک وب‌سایت فروشگاهی برای نمایش و فروش انواع کت (Coat)، ساخته‌شده با Node.js + Express، طراحی واکنش‌گرا، و مدیریت محصولات.

🚀 امکانات پروژه

طراحی کاملاً ریسپانسیو

صفحهٔ اصلی با بنر و دسته‌بندی‌ها

صفحهٔ لیست محصولات

صفحهٔ جزئیات محصول

فرم تماس با ما

امکان ارسال پیام خرید و تماس از طریق:

Telegram

Bale

WhatsApp

Instagram

ساختار قابل توسعه برای افزودن محصولات جدید

اتصال به دیتابیس MongoDB (local یا cloud)

🛠 تکنولوژی‌ها

Node.js + Express

HTML / CSS / JavaScript

Bootstrap

MongoDB / Mongoose

Git + GitHub

📥 نصب و اجرای پروژه
1) کلون کردن پروژه

در مسیر دلخواه ترمینال را باز کنید:

git clone git@github.com:mahdi-ghaemi/coat-website.git


وارد پوشه پروژه شوید:

cd coat-website

2) نصب پکیج‌ها
npm install

3) ایجاد فایل .env

در ریشه پروژه یک فایل .env بسازید:

MONGODB_URI=mongodb://127.0.0.1:27017/dapper-coat
PORT=3000

TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_ID=

BALE_BOT_TOKEN=
BALE_ADMIN_CHAT_ID=

ADMIN_MOBILE=
ADMIN_PASSWORD=

BALE_USERNAME=
TELEGRAM_USERNAME=
WHATSAPP_NUMBER=

🗄 راه‌اندازی دیتابیس (MongoDB لوکال)

اگر از MongoDB لوکال استفاده می‌کنید:

mongod --dbpath "آدرس پوشه دیتابیس"


در غیر این صورت می‌توانید از MongoDB Atlas استفاده کنید و مقدار MONGODB_URI را تغییر دهید.

▶️ اجرای پروژه
npm start


سپس در مرورگر وارد شوید:

http://localhost:3000/

📝 نکات مهم

برای ارسال پیام‌ها باید توکن‌های Bot را در .env وارد کنید.

برای افزودن محصولات جدید باید دیتابیس در حال اجرا باشد.

مقادیر .env را هرگز در GitHub آپلود نکنید.

🧥 Coat Website

A responsive e-commerce website for browsing and purchasing various types of coats, built with Node.js, Express, and MongoDB.

🚀 Features

Fully responsive design

Home page with banner and categories

Products list page

Single product details page

Contact Us form

Order notification system via:

Telegram

Bale

WhatsApp

Instagram

Easy-to-extend structure for adding new products

MongoDB integration (local or cloud)

🛠 Technologies Used

Node.js + Express

MongoDB / Mongoose

HTML / CSS / JavaScript

Bootstrap

Git & GitHub

📥 Installation & Setup
1) Clone the repository
git clone git@github.com:mahdi-ghaemi/coat-website.git
cd coat-website

2) Install dependencies
npm install

3) Create the .env file

In the project root, create a .env file with the following environment variables:

MONGODB_URI=mongodb://127.0.0.1:27017/dapper-coat
PORT=3000

TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_ID=

BALE_BOT_TOKEN=
BALE_ADMIN_CHAT_ID=

ADMIN_MOBILE=
ADMIN_PASSWORD=

BALE_USERNAME=
TELEGRAM_USERNAME=
WHATSAPP_NUMBER=


⚠️ Never commit your .env file to GitHub.

🗄 Setting Up MongoDB (Local)

If you are using local MongoDB:

mongod --dbpath "path/to/your/database"


Otherwise, you may use MongoDB Atlas and replace the MONGODB_URI with your cloud connection string.

▶️ Start the Application
npm start


Then open your browser and navigate to:

http://localhost:3000/

📝 Notes

Ensure your bot tokens and contact IDs are correctly set in the .env file.

MongoDB must be running to add or retrieve products.

If deploying to production, update environment variables on your server.
