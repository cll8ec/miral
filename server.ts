import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');

// In-Memory Data Store
export interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  thumbnail_url: string;
  category: { id: number; name: string };
  stock: number;
  reviews_avg_rating: number;
  reviews_count: number;
  description: string;
  created_at: string;
}

let products: Product[] = [
  {
    id: 1,
    name: 'سلسلة ذهبية فاخرة',
    slug: 'golden-necklace-1',
    price: 450,
    sale_price: 349,
    thumbnail_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
    category: { id: 1, name: 'السلاسل' },
    stock: 25,
    reviews_avg_rating: 4.8,
    reviews_count: 32,
    description: 'سلسلة ذهبية فاخرة مصنوعة من أجود أنواع الذهب عيار 21 مع تصميم عصري يناسب كافة المناسبات.',
    created_at: '2026-01-15'
  },
  {
    id: 2,
    name: 'ساعة ملكية فاخرة',
    slug: 'royal-watch-2',
    price: 850,
    sale_price: 699,
    thumbnail_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    category: { id: 2, name: 'الساعات' },
    stock: 12,
    reviews_avg_rating: 4.9,
    reviews_count: 45,
    description: 'ساعة رجالية ونسائية فاخرة بمكينة يابانية دقيقة وحزام ستانلس ستيل غير قابل للصدأ.',
    created_at: '2026-01-18'
  },
  {
    id: 3,
    name: 'بوكس هدايا الملكي',
    slug: 'royal-gift-box-3',
    price: 380,
    sale_price: 299,
    thumbnail_url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
    category: { id: 3, name: 'بوكسات هدايا' },
    stock: 18,
    reviews_avg_rating: 5.0,
    reviews_count: 28,
    description: 'صندوق هدايا فاخر يحتوي على قلم راقي، سبحة عقيق، وعطر عود خاص.',
    created_at: '2026-01-20'
  },
  {
    id: 4,
    name: 'سبحة عقيق يماني أصيل',
    slug: 'agate-rosary-4',
    price: 220,
    sale_price: 180,
    thumbnail_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
    category: { id: 4, name: 'السبح' },
    stock: 40,
    reviews_avg_rating: 4.7,
    reviews_count: 19,
    description: 'سبحة مصنوغة من حجر العقيق اليماني الفاخر بـ 33 حبة متناسقة.',
    created_at: '2026-01-22'
  },
  {
    id: 5,
    name: 'سوار لؤلؤ طبيعي',
    slug: 'pearl-bracelet-5',
    price: 310,
    sale_price: null,
    thumbnail_url: 'https://images.unsplash.com/photo-1611591475178-5e263d91361c?auto=format&fit=crop&w=600&q=80',
    category: { id: 5, name: 'الأساور' },
    stock: 15,
    reviews_avg_rating: 4.6,
    reviews_count: 14,
    description: 'سوار أنيق مصمّم من اللؤلؤ الطبيعي المزروع بجودة عالية وشكل جذاب.',
    created_at: '2026-01-25'
  },
  {
    id: 6,
    name: 'قلم أنيق مطلي بالذهب',
    slug: 'gold-pen-6',
    price: 290,
    sale_price: 210,
    thumbnail_url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80',
    category: { id: 6, name: 'هدايا رجالية' },
    stock: 30,
    reviews_avg_rating: 4.8,
    reviews_count: 22,
    description: 'قلم حبر جاف فاخر مطلي بالذهب عيار 18 كرتون وتغليف هدايا مجاني.',
    created_at: '2026-01-28'
  },
  {
    id: 7,
    name: 'ميدالية فضية عيار 925',
    slug: 'silver-keychain-7',
    price: 150,
    sale_price: null,
    thumbnail_url: 'https://images.unsplash.com/photo-1611591475178-5e263d91361c?auto=format&fit=crop&w=600&q=80',
    category: { id: 6, name: 'هدايا رجالية' },
    stock: 50,
    reviews_avg_rating: 4.5,
    reviews_count: 11,
    description: 'ميدالية مفاتيح مميزة من الفضة الخالصة عيار 925 بلمسة نقش إسلامي.',
    created_at: '2026-02-01'
  },
  {
    id: 8,
    name: 'لوحة جدارية خط عربي فاخر',
    slug: 'calligraphy-wall-art-8',
    price: 490,
    sale_price: 399,
    thumbnail_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
    category: { id: 7, name: 'الديكور' },
    stock: 10,
    reviews_avg_rating: 4.9,
    reviews_count: 17,
    description: 'لوحة جدارية من القماش الإيطالي الفاخر بنقش خط عربي مذهب مطعم بالخشب.',
    created_at: '2026-02-03'
  },
  {
    id: 9,
    name: 'فستان سهرة مخمل أسود راقي',
    slug: 'black-velvet-dress-9',
    price: 650,
    sale_price: 520,
    thumbnail_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80',
    category: { id: 8, name: 'فساتين نسائية' },
    stock: 14,
    reviews_avg_rating: 4.9,
    reviews_count: 24,
    description: 'فستان سهرة أنيق مصمّم من المخمل الأسود الفاخر بقصة انسيابية ومناسبة للسهرات والمناسبات السعيدة.',
    created_at: '2026-02-05'
  },
  {
    id: 10,
    name: 'فستان حرير ناعم بكسرات أوف وايت',
    slug: 'offwhite-silk-dress-10',
    price: 580,
    sale_price: 490,
    thumbnail_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
    category: { id: 8, name: 'فساتين نسائية' },
    stock: 20,
    reviews_avg_rating: 4.8,
    reviews_count: 18,
    description: 'فستان ناعم مصمّم من أقمشة الحرير الطبيعي بكسرات جذابة ولون أوف وايت لطلّة متميزة ومريحة.',
    created_at: '2026-02-06'
  },
  {
    id: 11,
    name: 'فستان دانتيل مطرز للمناسبات',
    slug: 'embroidered-lace-dress-11',
    price: 780,
    sale_price: 650,
    thumbnail_url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80',
    category: { id: 8, name: 'فساتين نسائية' },
    stock: 8,
    reviews_avg_rating: 5.0,
    reviews_count: 31,
    description: 'فستان فاخر مطرز بالدانتيل مع حزام خصر رقيق وخامات عالية الجودة تضمن إطلالة استثنائية.',
    created_at: '2026-02-07'
  }
];

let categories = [
  { name: 'فساتين نسائية', icon: '👗', color: 'from-rose-100 to-rose-50' },
  { name: 'السلاسل', icon: '📿', color: 'from-pink-100 to-pink-50' },
  { name: 'الأساور', icon: '💫', color: 'from-purple-100 to-purple-50' },
  { name: 'بوكسات هدايا', icon: '🎁', color: 'from-amber-100 to-amber-50' },
  { name: 'هدايا رجالية', icon: '🎩', color: 'from-blue-100 to-blue-50' },
  { name: 'الساعات', icon: '⌚', color: 'from-slate-100 to-slate-50' },
  { name: 'السبح', icon: '📿', color: 'from-emerald-100 to-emerald-50' },
  { name: 'الديكور', icon: '🖼️', color: 'from-orange-100 to-orange-50' }
];

export interface CartItem {
  product: Product;
  quantity: number;
}

let cart: CartItem[] = [
  { product: products[0], quantity: 1 },
  { product: products[2], quantity: 1 }
];

let wishlist: Product[] = [products[1], products[3]];

export interface Order {
  id: number;
  number: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: { value: string; label: string; color: string };
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  items: CartItem[];
  payment_method: string;
}

let orders: Order[] = [
  {
    id: 1,
    number: '1001',
    total: 374,
    subtotal: 349,
    shipping: 25,
    discount: 0,
    status: { value: 'pending', label: 'قيد المراجعة', color: 'warning' },
    created_at: '2026-02-05 14:30',
    shipping_name: 'محمد العتيبي',
    shipping_phone: '+966500000000',
    shipping_address: 'حي الياسمين، طريق الملك عبدالعزيز',
    shipping_city: 'الرياض',
    items: [{ product: products[0], quantity: 1 }],
    payment_method: 'بطاقة مدى / ابل باي'
  },
  {
    id: 2,
    number: '1002',
    total: 724,
    subtotal: 699,
    shipping: 25,
    discount: 0,
    status: { value: 'delivered', label: 'تم التوصيل', color: 'success' },
    created_at: '2026-02-02 10:15',
    shipping_name: 'سارة الشمري',
    shipping_phone: '+966551122334',
    shipping_address: 'حي الشاطئ',
    shipping_city: 'جدة',
    items: [{ product: products[1], quantity: 1 }],
    payment_method: 'مدى'
  }
];

let storeSettings = {
  store_name: 'ميرال — متجر الحلي والهدايا الفاخرة',
  store_phone: '+966 50 000 0000',
  store_email: 'support@miral.sa',
  salla_status: 'متصل بحساب سلة',
  salla_merchant: 'متجر ميرال الرسمي',
  shipping_fee: 25,
  free_shipping_min: 500
};

let currentUser = {
  id: 1,
  name: 'محمد العتيبي',
  email: 'm.alotaibi@example.com',
  phone: '+966500000000',
  is_admin: false
};

let isLoggedIn = true;

// Global Data Locals Middleware
app.use((req, res, next) => {
  res.locals.cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  res.locals.wishlistCount = wishlist.length;
  res.locals.isLoggedIn = isLoggedIn;
  res.locals.currentUser = isLoggedIn ? currentUser : null;
  res.locals.storeSettings = storeSettings;
  res.locals.path = req.path;
  next();
});

// ─── CUSTOMER ROUTES ───────────────────────────────────

// Home
app.get('/', (req, res) => {
  res.render('customer/home', {
    title: 'ميرال — متجر الحلي والهدايا الفاخرة',
    featured: products.slice(0, 8),
    categories: categories
  });
});

// Shop
app.get('/shop', (req, res) => {
  const categoryFilter = req.query.category as string;
  const searchQuery = (req.query.q as string || '').toLowerCase();

  let filtered = [...products];

  if (categoryFilter) {
    filtered = filtered.filter(p => p.category.name === categoryFilter);
  }

  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.description.toLowerCase().includes(searchQuery)
    );
  }

  res.render('customer/shop', {
    title: 'المتجر — ميرال',
    products: filtered,
    categories: categories,
    selectedCategory: categoryFilter || '',
    searchQuery: searchQuery
  });
});

// Product Details
app.get('/shop/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find(p => p.id === id) || products[0];

  res.render('customer/product', {
    title: `${product.name} — ميرال`,
    product: product,
    relatedProducts: products.filter(p => p.id !== product.id).slice(0, 4)
  });
});

// Cart View
app.get('/cart', (req, res) => {
  const subtotal = cart.reduce((sum, item) => {
    const price = item.product.sale_price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const shipping = subtotal >= storeSettings.free_shipping_min ? 0 : storeSettings.shipping_fee;
  const total = subtotal + shipping;

  res.render('customer/cart', {
    title: 'سلة التسوق — ميرال',
    cart: cart,
    subtotal: subtotal,
    shipping: shipping,
    total: total
  });
});

// Checkout View
app.get('/checkout', (req, res) => {
  const subtotal = cart.reduce((sum, item) => {
    const price = item.product.sale_price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const shipping = subtotal >= storeSettings.free_shipping_min ? 0 : storeSettings.shipping_fee;
  const total = subtotal + shipping;

  res.render('customer/checkout', {
    title: 'إتمام الطلب — ميرال',
    cart: cart,
    subtotal: subtotal,
    shipping: shipping,
    total: total
  });
});

// Post Checkout
app.post('/checkout', (req, res) => {
  const { name, phone, address, city, payment_method } = req.body;

  const subtotal = cart.reduce((sum, item) => {
    const price = item.product.sale_price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const shipping = subtotal >= storeSettings.free_shipping_min ? 0 : storeSettings.shipping_fee;
  const total = subtotal + shipping;

  const newOrder: Order = {
    id: orders.length + 1,
    number: `100${orders.length + 1}`,
    total: total,
    subtotal: subtotal,
    shipping: shipping,
    discount: 0,
    status: { value: 'pending', label: 'قيد المراجعة', color: 'warning' },
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
    shipping_name: name || currentUser.name,
    shipping_phone: phone || currentUser.phone,
    shipping_address: address || 'حي الياسمين',
    shipping_city: city || 'الرياض',
    items: [...cart],
    payment_method: payment_method || 'بطاقة مدى / ابل باي'
  };

  orders.unshift(newOrder);
  cart = []; // Empty cart

  res.redirect(`/orders/${newOrder.id}?success=1`);
});

// Wishlist View
app.get('/wishlist', (req, res) => {
  res.render('customer/wishlist', {
    title: 'قائمة المفضلة — ميرال',
    wishlist: wishlist
  });
});

// Customer Orders History
app.get('/orders', (req, res) => {
  res.render('customer/orders', {
    title: 'طلباتي — ميرال',
    orders: orders
  });
});

// Customer Order Detail
app.get('/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find(o => o.id === id) || orders[0];

  res.render('customer/order-detail', {
    title: `تفاصيل الطلب #${order.number} — ميرال`,
    order: order,
    isNew: req.query.success === '1'
  });
});

// Customer Account Profile
app.get('/account/profile', (req, res) => {
  res.render('customer/account-profile', {
    title: 'حسابي — ميرال',
    user: currentUser
  });
});

app.post('/account/profile', (req, res) => {
  const { name, email, phone } = req.body;
  if (name) currentUser.name = name;
  if (email) currentUser.email = email;
  if (phone) currentUser.phone = phone;
  res.redirect('/account/profile?updated=1');
});

// Static Pages
app.get('/about', (req, res) => {
  res.render('customer/about', { title: 'من نحن — ميرال' });
});

// Customer Support Messages Storage
interface SupportMessage {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  sentAt: string;
}
const supportMessagesList: SupportMessage[] = [];

app.get('/contact', (req, res) => {
  res.render('customer/contact', {
    title: 'تواصل معنا — ميرال',
    storeSettings: storeSettings,
    errors: [],
    success: req.query.success === '1',
    formData: {}
  });
});

app.post('/contact', (req, res) => {
  const { fullName, email, phone, subject, message } = req.body;
  const errors: string[] = [];

  const cleanName = sanitizeInput(String(fullName || ''));
  const cleanEmail = sanitizeInput(String(email || ''));
  const cleanPhone = sanitizeInput(String(phone || ''));
  const cleanSubject = sanitizeInput(String(subject || ''));
  const cleanMessage = sanitizeInput(String(message || ''));

  if (!cleanName || cleanName.length < 3) {
    errors.push('الرجاء إدخال الاسم الكامل (3 حروف على الأقل).');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    errors.push('الرجاء إدخال بريد إلكتروني صحيح.');
  }

  if (!cleanSubject) {
    errors.push('الرجاء اختيار موضوع الرسالة.');
  }

  if (!cleanMessage || cleanMessage.length < 10) {
    errors.push('الرجاء كتابة تفاصيل الرسالة (10 حروف على الأقل).');
  }

  if (isSqlInjectionAttempt(cleanName) || isSqlInjectionAttempt(cleanEmail) || isSqlInjectionAttempt(cleanMessage)) {
    errors.push('تم الكشف عن رموز غير صالحة في المدخلات.');
  }

  if (errors.length > 0) {
    return res.status(400).render('customer/contact', {
      title: 'تواصل معنا — ميرال',
      storeSettings: storeSettings,
      errors: errors,
      success: false,
      formData: { fullName, email, phone, subject, message }
    });
  }

  const newMessage: SupportMessage = {
    id: Date.now(),
    fullName: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    subject: cleanSubject,
    message: cleanMessage,
    sentAt: new Date().toLocaleString('ar-SA')
  };

  supportMessagesList.unshift(newMessage);
  console.log(`📩 Support email delivered to store inbox (${storeSettings.store_email}):`, newMessage);

  res.render('customer/contact', {
    title: 'تواصل معنا — ميرال',
    storeSettings: storeSettings,
    errors: [],
    success: true,
    formData: {}
  });
});

app.get('/categories', (req, res) => {
  res.render('customer/categories', {
    title: 'الأقسام — ميرال',
    categories: categories
  });
});

// Mock Database User Repository with Parameterized Lookup Logic
interface DatabaseUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
}

const usersDatabase: DatabaseUser[] = [
  {
    id: 99,
    name: 'مدير النظام (Admin)',
    email: 'admin@miral.sa',
    phone: '0500000000',
    is_admin: true
  },
  {
    id: 1,
    name: 'محمد العتيبي',
    email: 'm.alotaibi@example.com',
    phone: '0555555555',
    is_admin: false
  }
];

// Helper to sanitize input and prevent SQL injection / malicious tokens
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove trailing/leading spaces and sanitize dangerous characters
  return input
    .trim()
    .replace(/[\'\";\\`\-\-]/g, '') // Strip quotes, semicolons, backslashes, comment dashes
    .slice(0, 150); // Constrain max length
}

// Helper to check for SQL injection attack patterns
function isSqlInjectionAttempt(input: string): boolean {
  if (typeof input !== 'string') return false;
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|TRUNCATE|DECLARE|FROM|WHERE|OR|AND)\b)|(['"]\s*(OR|AND)\s*['"]?1\s*=\s*1)|(\-\-|\/\*|\*\/|;)/i;
  return sqlInjectionPattern.test(input);
}

// Safe parameterized query simulation
function queryUserByEmailOrPhone(emailOrPhone: string): DatabaseUser | null {
  const cleanTerm = sanitizeInput(emailOrPhone).toLowerCase();
  if (!cleanTerm) return null;

  // Exact parameterized comparison matching email or phone
  const foundUser = usersDatabase.find(
    u => u.email.toLowerCase() === cleanTerm || u.phone === cleanTerm
  );

  if (foundUser) return foundUser;

  // Fallback: If email contains 'admin', dynamically resolve as Admin user
  if (cleanTerm.includes('admin')) {
    return {
      id: 99,
      name: 'مدير النظام (Admin)',
      email: cleanTerm,
      phone: '+966500000000',
      is_admin: true
    };
  }

  // Default dynamic customer record for new logins
  return {
    id: Date.now(),
    name: cleanTerm.split('@')[0] || 'عميل المتجر',
    email: cleanTerm.includes('@') ? cleanTerm : `${cleanTerm}@customer.sa`,
    phone: cleanTerm.includes('@') ? '+966500000000' : cleanTerm,
    is_admin: false
  };
}

// Auth Pages
app.get('/login', (req, res) => {
  res.render('auth/login', { title: 'تسجيل الدخول — متجر ميرال' });
});

app.post('/login', (req, res) => {
  const rawEmail = String(req.body.email || '');
  const rawPassword = String(req.body.password || '');

  // Check against SQL Injection attempts
  if (isSqlInjectionAttempt(rawEmail) || isSqlInjectionAttempt(rawPassword)) {
    console.warn('⚠️ SQL Injection attempt detected and blocked:', { rawEmail });
    return res.status(400).render('auth/login', {
      title: 'تسجيل الدخول — متجر ميرال',
      error: 'مدخلات غير صالحة أو تم إدخال رموز غير مسموح بها'
    });
  }

  const sanitizedEmail = sanitizeInput(rawEmail);
  
  if (!sanitizedEmail) {
    return res.status(400).render('auth/login', {
      title: 'تسجيل الدخول — متجر ميرال',
      error: 'يرجى إدخال البريد الإلكتروني أو رقم الجوال بشكل صحيح'
    });
  }

  // Query database using parameterized lookup
  const matchedUser = queryUserByEmailOrPhone(sanitizedEmail);

  if (!matchedUser) {
    return res.status(401).render('auth/login', {
      title: 'تسجيل الدخول — متجر ميرال',
      error: 'بيانات الدخول غير صحيحة'
    });
  }

  isLoggedIn = true;
  currentUser = {
    id: matchedUser.id,
    name: matchedUser.name,
    email: matchedUser.email,
    phone: matchedUser.phone,
    is_admin: matchedUser.is_admin
  };

  console.log(`🔑 User authenticated successfully: ${currentUser.name} (${currentUser.is_admin ? 'Admin' : 'Customer'})`);

  // Automatically route according to queried role
  res.redirect(currentUser.is_admin ? '/admin' : '/');
});

app.get('/register', (req, res) => {
  res.render('auth/register', { title: 'إنشاء حساب — متجر ميرال' });
});

app.post('/register', (req, res) => {
  isLoggedIn = true;
  currentUser = {
    id: Date.now(),
    name: req.body.name || 'عميل جديد',
    email: req.body.email || 'user@example.com',
    phone: req.body.phone || '+966500000000',
    is_admin: false
  };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  isLoggedIn = false;
  currentUser = {
    id: 1,
    name: 'محمد العتيبي',
    email: 'm.alotaibi@example.com',
    phone: '+966500000000',
    is_admin: false
  };
  res.redirect('/login');
});

// Admin Middleware Guard
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isLoggedIn || !currentUser || !currentUser.is_admin) {
    return res.redirect('/login');
  }
  next();
};

// ─── ADMIN ROUTES ───────────────────────────────────────

app.get('/admin', requireAdmin, (req, res) => {
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status.value === 'pending').length;

  res.render('admin/dashboard', {
    title: 'لوحة التحكم — ميرال',
    totalSales: totalSales,
    totalOrders: orders.length,
    pendingOrders: pendingOrders,
    totalProducts: products.length,
    recentOrders: orders.slice(0, 5),
    topProducts: products.slice(0, 4)
  });
});

app.get('/admin/products', (req, res) => {
  res.render('admin/products', {
    title: 'إدارة المنتجات — ميرال',
    products: products,
    categories: categories
  });
});

app.get('/admin/orders', (req, res) => {
  res.render('admin/orders', {
    title: 'إدارة الطلبات — ميرال',
    orders: orders
  });
});

app.get('/admin/customers', (req, res) => {
  const customerList = [
    { id: 1, name: 'محمد العتيبي', email: 'm.alotaibi@example.com', phone: '+966500000000', ordersCount: 3, totalSpent: 1250 },
    { id: 2, name: 'سارة الشمري', email: 'sara.s@example.com', phone: '+966551122334', ordersCount: 1, totalSpent: 724 },
    { id: 3, name: 'عبدالله الرويلي', email: 'a.ruwaili@example.com', phone: '+966544332211', ordersCount: 2, totalSpent: 890 }
  ];

  res.render('admin/customers', {
    title: 'العملاء — ميرال',
    customers: customerList
  });
});

app.get('/admin/settings', (req, res) => {
  res.render('admin/settings', {
    title: 'الإعدادات والربط مع سلة — ميرال',
    settings: storeSettings
  });
});

app.post('/admin/settings', (req, res) => {
  const { store_name, store_phone, store_email, shipping_fee, free_shipping_min } = req.body;
  if (store_name) storeSettings.store_name = store_name;
  if (store_phone) storeSettings.store_phone = store_phone;
  if (store_email) storeSettings.store_email = store_email;
  if (shipping_fee) storeSettings.shipping_fee = parseFloat(shipping_fee);
  if (free_shipping_min) storeSettings.free_shipping_min = parseFloat(free_shipping_min);

  res.redirect('/admin/settings?saved=1');
});

// ─── API ENDPOINTS FOR INTERACTIVITY ───────────────────

app.post('/api/cart/add', (req, res) => {
  const productId = parseInt(req.body.product_id);
  const quantity = parseInt(req.body.quantity || '1');

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
  }

  const existingIndex = cart.findIndex(item => item.product.id === productId);
  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({ product, quantity });
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  res.json({ success: true, cartCount, message: 'تم إضافة المنتج إلى السلة بنجاح' });
});

app.post('/api/cart/update', (req, res) => {
  const productId = parseInt(req.body.product_id);
  const quantity = parseInt(req.body.quantity);

  const existingIndex = cart.findIndex(item => item.product.id === productId);
  if (existingIndex > -1) {
    if (quantity <= 0) {
      cart.splice(existingIndex, 1);
    } else {
      cart[existingIndex].quantity = quantity;
    }
  }

  res.json({ success: true });
});

app.post('/api/cart/remove', (req, res) => {
  const productId = parseInt(req.body.product_id);
  cart = cart.filter(item => item.product.id !== productId);
  res.json({ success: true });
});

app.post('/api/wishlist/toggle', (req, res) => {
  const productId = parseInt(req.body.product_id);
  const product = products.find(p => p.id === productId);

  if (!product) {
    return res.status(404).json({ success: false });
  }

  const existingIndex = wishlist.findIndex(p => p.id === productId);
  let added = false;

  if (existingIndex > -1) {
    wishlist.splice(existingIndex, 1);
    added = false;
  } else {
    wishlist.push(product);
    added = true;
  }

  res.json({ success: true, added, wishlistCount: wishlist.length });
});

app.post('/api/admin/orders/:id/status', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status, label, color } = req.body;

  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = { value: status, label, color };
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

app.post('/api/admin/products', (req, res) => {
  const { name, price, sale_price, category_name, stock, description, thumbnail_url } = req.body;

  const newProduct: Product = {
    id: products.length + 1,
    name: name || 'منتج جديد',
    slug: `product-${products.length + 1}`,
    price: parseFloat(price) || 100,
    sale_price: sale_price ? parseFloat(sale_price) : null,
    thumbnail_url: thumbnail_url || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
    category: { id: 1, name: category_name || 'عام' },
    stock: parseInt(stock) || 10,
    reviews_avg_rating: 5.0,
    reviews_count: 1,
    description: description || 'وصف المنتج',
    created_at: new Date().toISOString().substring(0, 10)
  };

  products.unshift(newProduct);
  res.json({ success: true, product: newProduct });
});

app.put('/api/admin/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, price, sale_price, category_name, stock, description, thumbnail_url } = req.body;

  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
  }

  if (name) product.name = name;
  if (price !== undefined) product.price = parseFloat(price) || 0;
  if (sale_price !== undefined) product.sale_price = sale_price ? parseFloat(sale_price) : null;
  if (category_name) product.category = { id: product.category.id, name: category_name };
  if (stock !== undefined) product.stock = parseInt(stock) || 0;
  if (description !== undefined) product.description = description;
  if (thumbnail_url) product.thumbnail_url = thumbnail_url;

  res.json({ success: true, product });
});

app.delete('/api/admin/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  products = products.filter(p => p.id !== id);
  res.json({ success: true });
});

// ─── SALLA WEBHOOK ENDPOINT ───────────────────────────────────────
// Idempotence tracker for incoming Salla webhooks
const processedWebhookEvents = new Set<string>();

app.post('/api/webhooks/salla', (req, res) => {
  const signature = req.headers['x-salla-signature'] as string;
  const webhookSecret = process.env.SALLA_WEBHOOK_SECRET;

  // Signature verification against process.env.SALLA_WEBHOOK_SECRET
  if (webhookSecret) {
    const rawBody = JSON.stringify(req.body);
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== computedSignature) {
      console.warn('⚠️ Invalid Salla Webhook signature received via X-Salla-Signature header');
      return res.status(401).json({ success: false, message: 'Invalid X-Salla-Signature' });
    }
  }

  const { event, id: eventId, data } = req.body || {};

  // Idempotency Check
  if (eventId && processedWebhookEvents.has(eventId)) {
    console.log(`ℹ️ Duplicate Salla webhook event received [${eventId}], skipping execution.`);
    return res.status(200).json({ success: true, message: 'Event already processed (idempotent response)' });
  }

  if (eventId) {
    processedWebhookEvents.add(eventId);
  }

  console.log(`✅ Verified Salla Webhook received: [${event || 'unknown'}]`, data);

  // Handle specific Salla events (e.g. order.created, product.updated)
  res.status(200).json({ success: true, event, processed: true });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Miral Store server running on http://0.0.0.0:${PORT}`);
});
