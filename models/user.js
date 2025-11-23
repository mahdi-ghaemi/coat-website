import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now }
// });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },  // نام
  lastName: { type: String, required: true, trim: true },   // نام خانوادگی
  mobile: { type: String, required: true, unique: true },   // موبایل (الزامی و یکتا)
  password: { type: String, required: true },               // رمز عبور

  email: { type: String, trim: true, lowercase: true },     // اختیاری
  address: { type: String, default: "" },                   // اختیاری
  postalCode: { type: String, default: "" },                // اختیاری

  role: {                                                   // نقش کاربر
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  createdAt: { type: Date, default: Date.now }
});



// رمزنگاری پسورد قبل از ذخیره
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();//اگر فیلد password در سند تغییر نکرده، عبور کن و هش جدید نساز. 
                                                  // این جلوگیری می‌کند از دوبار هش شدن پاسورد هنگام update فیلدهای دیگر.
  const salt = await bcrypt.genSalt(10); //تولید salt با 10 دور
  this.password = await bcrypt.hash(this.password, salt); //هش کردن پسورد و ذخیره‌ی هش در فیلد password. 
                                                          // بنابراین پسورد خام هرگز در دیتابیس ذخیره نمی‌شود.
  next();                   //ادامهٔ عملیات ذخیره.
});

// تابع کمکی برای چک کردن رمز
userSchema.methods.comparePassword = async function (password) { //comparePassword یک تابع async است که
                                                                 //  bcrypt.compare(plain, hashed) را اجرا می‌کند و true یا false برمی‌گرداند.
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);               //مدل Mongoose ساخته و صادر شد.
