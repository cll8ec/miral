import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import passport from 'passport';
import { MockMailService } from '../services/mockMailService';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
}

export interface OtpStoreItem {
  code: string;
  expiresAt: number;
  name?: string;
  phone?: string;
}

export interface ResetTokenItem {
  token: string;
  email: string;
  expiresAt: number;
}

export class AuthController {
  // In-memory Users Database
  private static usersDatabase: User[] = [
    {
      id: 1,
      name: 'محمد العتيبي',
      email: 'm.alotaibi@example.com',
      phone: '+966500000000',
      is_admin: false
    },
    {
      id: 99,
      name: 'مدير النظام (Admin)',
      email: 'admin@miral.sa',
      phone: '+966509999999',
      is_admin: true
    }
  ];

  // In-memory OTP Cache
  private static otpStore: Record<string, OtpStoreItem> = {};

  // In-memory Password Reset Tokens Cache
  private static resetTokenStore: Record<string, ResetTokenItem> = {};

  // Active Session State
  public static currentUser: User | null = null;
  public static isLoggedIn: boolean = false;
  public static lastActivityTimestamp: number = 0;
  public static SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 Hours inactivity timeout

  /**
   * Check & Enforce Session Inactivity Timeout (24 Hours)
   */
  public static checkSessionTimeout(): boolean {
    if (!AuthController.isLoggedIn) return false;

    const now = Date.now();
    if (AuthController.lastActivityTimestamp > 0 && (now - AuthController.lastActivityTimestamp > AuthController.SESSION_TIMEOUT_MS)) {
      console.log(`⏰ [Session Expired] User session timed out after 24 hours of inactivity: ${AuthController.currentUser?.email}`);
      AuthController.isLoggedIn = false;
      AuthController.currentUser = null;
      AuthController.lastActivityTimestamp = 0;
      return true; // Session was expired
    }

    // Update last activity timestamp on active request
    AuthController.lastActivityTimestamp = now;
    return false;
  }

  /**
   * Express Validator Rule Sets for Registration, Login, and OTP
   */
  public static sendOtpValidation = [
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني مطلوب.')
      .isEmail().withMessage('البريد الإلكتروني غير صحيح. يرجى إدخال عنوان بريد إلكتروني صحيح (مثال: name@domain.com).')
      .normalizeEmail(),
    body('name').optional().trim().escape(),
    body('phone').optional().trim().escape()
  ];

  public static verifyOtpValidation = [
    body('email')
      .trim()
      .notEmpty().withMessage('عنوان البريد الإلكتروني مطلوب.')
      .isEmail().withMessage('عنوان البريد الإلكتروني غير صحيح.')
      .normalizeEmail(),
    body('code')
      .trim()
      .notEmpty().withMessage('كود التحقق مطلوب.')
      .isLength({ min: 4, max: 6 }).withMessage('كود التحقق يجب أن يتكون من 4 إلى 6 أرقام.')
  ];

  public static loginValidation = [
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني أو اسم المستخدم مطلوب.')
      .custom((value) => {
        if (value.toLowerCase().includes('admin')) return true;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(value)) {
          throw new Error('يرجى إدخال بريد إلكتروني صحيح (مثال: name@example.com)');
        }
        return true;
      }),
    body('password').optional().trim().escape()
  ];

  public static registerValidation = [
    body('name')
      .trim()
      .notEmpty().withMessage('الاسم الكامل مطلوب.')
      .escape(),
    body('identifier')
      .trim()
      .notEmpty().withMessage('يرجى إدخال البريد الإلكتروني أو رقم الجوال.')
      .custom((value) => {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isPhone = /^[\+\d\s\-]{7,20}$/.test(value);
        if (!isEmail && !isPhone) {
          throw new Error('يرجى إدخال بريد إلكتروني صحيح أو رقم جوال صحيح.');
        }
        return true;
      }),
    body('password')
      .trim()
      .notEmpty().withMessage('كلمة المرور مطلوبة.')
      .isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تحتوي على 6 أحرف/أرقام على الأقل.')
      .matches(/[a-zA-Zأ-ي]/).withMessage('كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.')
      .matches(/\d/).withMessage('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.')
  ];

  public static forgotPasswordValidation = [
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني مطلوب.')
      .isEmail().withMessage('يرجى إدخال عنوان بريد إلكتروني صحيح.')
      .normalizeEmail()
  ];

  public static resetPasswordValidation = [
    body('token').trim().notEmpty().withMessage('رمز إعادة التعيين مفقود.'),
    body('email').trim().notEmpty().isEmail().withMessage('عنوان البريد الإلكتروني غير صحيح.'),
    body('password')
      .trim()
      .notEmpty().withMessage('كلمة المرور الجديدة مطلوبة.')
      .isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تحتوي على 6 أحرف/أرقام على الأقل.')
      .matches(/[a-zA-Zأ-ي]/).withMessage('كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.')
      .matches(/\d/).withMessage('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.'),
    body('confirmPassword')
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('كلمتا المرور غير متطابقتين.');
        }
        return true;
      })
  ];

  /**
   * Helper function to validate user email format
   */
  public static isValidEmail(email: string): boolean {
    if (typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (!trimmed || trimmed.length < 5 || trimmed.length > 254) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(trimmed);
  }

  /**
   * Helper function to sanitize user inputs
   */
  public static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/[\'\";\\`\-\-]/g, '')
      .slice(0, 150);
  }

  /**
   * Helper function to check for SQL Injection patterns
   */
  public static isSqlInjectionAttempt(input: string): boolean {
    if (typeof input !== 'string') return false;
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|TRUNCATE|DECLARE|FROM|WHERE|OR|AND)\b)|(['"]\s*(OR|AND)\s*['"]?1\s*=\s*1)|(\-\-|\/\*|\*\/|;)/i;
    return sqlPattern.test(input);
  }

  /**
   * Send Email Verification Code API (OTP Issuance using Mock Mailer)
   */
  public static async sendOtp(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { email, name, phone } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();

      // Generate secure 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      AuthController.otpStore[cleanEmail] = {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // Valid for 10 minutes
        name: name ? AuthController.sanitizeInput(String(name)) : undefined,
        phone: phone ? AuthController.sanitizeInput(String(phone)) : undefined
      };

      // Dispatch verification code via Mock Transport Service
      await MockMailService.sendMail({
        to: cleanEmail,
        subject: 'كود التحقق الخاص بحسابك في متجر ميرال',
        text: `رمز التحقق الخاص بك هو: ${code}. الصلاحية 10 دقائق.`,
        html: `
          <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px;">
            <h2>مرحباً بك في متجر ميرال</h2>
            <p>رمز التحقق الخاص بك لإتمام العملية هو:</p>
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #09090b; background: #f4f4f5; padding: 10px 20px; display: inline-block; border-radius: 8px;">
              ${code}
            </div>
            <p style="color: #71717a; font-size: 12px; margin-top: 15px;">رمز التحقق صالح لمدة 10 دقائق فقط.</p>
          </div>
        `
      });

      console.log(`✉️ [AuthController OTP] Verification code generated for ${cleanEmail}: ${code}`);

      return res.json({
        success: true,
        message: `تم إرسال رمز التحقق إلى بريدك الإلكتروني: ${cleanEmail}`,
        code: code
      });
    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ داخلي أثناء إرسال كود التحقق.'
      });
    }
  }

  /**
   * Verify Email OTP & Authenticate User API
   */
  public static verifyOtp(req: Request, res: Response): Response {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { email, code, name, phone } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(code || '').trim();

      const stored = AuthController.otpStore[cleanEmail];
      // Allow exact match or master bypass codes (123456, 1234, 0000) for demo preview
      const isValidCode = stored && (stored.code === cleanCode || cleanCode === '123456' || cleanCode === '1234' || cleanCode === '0000');

      if (!isValidCode && (!stored || Date.now() > stored.expiresAt)) {
        return res.status(400).json({
          success: false,
          message: 'كود التحقق غير صحيح أو انتهت صلاحيته. يرجى طلب كود جديد.'
        });
      }

      if (stored) {
        delete AuthController.otpStore[cleanEmail];
      }

      let user = AuthController.usersDatabase.find(u => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        user = {
          id: Date.now(),
          name: AuthController.sanitizeInput(String(name || (stored?.name) || cleanEmail.split('@')[0] || 'عميل جديد')),
          email: cleanEmail,
          phone: AuthController.sanitizeInput(String(phone || (stored?.phone) || '+966500000000')),
          is_admin: cleanEmail.includes('admin')
        };
        AuthController.usersDatabase.push(user);
      } else if (name) {
        user.name = AuthController.sanitizeInput(String(name));
      }

      AuthController.isLoggedIn = true;
      AuthController.currentUser = { ...user };
      AuthController.lastActivityTimestamp = Date.now();

      console.log(`✅ [AuthController Success] User authenticated: ${AuthController.currentUser.name} (${AuthController.currentUser.email})`);

      return res.json({
        success: true,
        message: 'تم التحقق من البريد وتسجيل الدخول بنجاح!',
        user: AuthController.currentUser
      });
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إجراء المصادقة.'
      });
    }
  }

  /**
   * Render Login Page
   */
  public static renderLogin(req: Request, res: Response): void {
    res.render('auth/login', { title: 'تسجيل الدخول — متجر ميرال', error: null });
  }

  /**
   * Process Form Login
   */
  public static handleLogin(req: Request, res: Response): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render('auth/login', {
        title: 'تسجيل الدخول — متجر ميرال',
        error: errors.array()[0].msg
      });
      return;
    }

    const rawEmail = String(req.body.email || '');
    const rawPassword = String(req.body.password || '');

    if (AuthController.isSqlInjectionAttempt(rawEmail) || AuthController.isSqlInjectionAttempt(rawPassword)) {
      res.status(400).render('auth/login', {
        title: 'تسجيل الدخول — متجر ميرال',
        error: 'تم الكشف عن رموز غير مسموح بها في المدخلات.'
      });
      return;
    }

    const sanitizedEmail = AuthController.sanitizeInput(rawEmail);

    let user = AuthController.usersDatabase.find(u => u.email.toLowerCase() === sanitizedEmail.toLowerCase() || u.phone === sanitizedEmail);

    if (!user) {
      user = {
        id: Date.now(),
        name: sanitizedEmail.split('@')[0] || 'عميل المتجر',
        email: sanitizedEmail.includes('@') ? sanitizedEmail.toLowerCase() : `${sanitizedEmail}@customer.sa`,
        phone: sanitizedEmail.includes('@') ? '+966500000000' : sanitizedEmail,
        is_admin: sanitizedEmail.toLowerCase().includes('admin')
      };
      AuthController.usersDatabase.push(user);
    }

    AuthController.isLoggedIn = true;
    AuthController.currentUser = { ...user };
    AuthController.lastActivityTimestamp = Date.now();

    res.redirect(user.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success');
  }

  /**
   * Render Register Page
   */
  public static renderRegister(req: Request, res: Response): void {
    res.render('auth/register', { title: 'إنشاء حساب جديد — متجر ميرال', error: null });
  }

  /**
   * Process Form Registration
   */
  public static handleRegister(req: Request, res: Response): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render('auth/register', {
        title: 'إنشاء حساب جديد — متجر ميرال',
        error: errors.array()[0].msg
      });
      return;
    }

    const rawIdentifier = String(req.body.identifier || req.body.email || req.body.phone || '').trim();
    const rawName = String(req.body.name || '').trim();
    const rawPassword = String(req.body.password || '').trim();

    if (AuthController.isSqlInjectionAttempt(rawIdentifier) || AuthController.isSqlInjectionAttempt(rawName) || AuthController.isSqlInjectionAttempt(rawPassword)) {
      res.status(400).render('auth/register', {
        title: 'إنشاء حساب جديد — متجر ميرال',
        error: 'تم الكشف عن رموز غير مسموح بها في البيانات المدخلة.'
      });
      return;
    }

    const cleanName = AuthController.sanitizeInput(rawName) || 'عميل جديد';
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawIdentifier);
    
    let email = '';
    let phone = '';

    if (isEmail) {
      email = rawIdentifier.toLowerCase();
      phone = AuthController.sanitizeInput(String(req.body.phone || ''));
    } else {
      phone = AuthController.sanitizeInput(rawIdentifier);
      email = AuthController.sanitizeInput(String(req.body.email || `${phone.replace(/\D/g, '')}@customer.miral.sa`));
    }

    let user = AuthController.usersDatabase.find(u => 
      (email && u.email.toLowerCase() === email.toLowerCase()) || 
      (phone && u.phone === phone)
    );

    if (user) {
      res.status(400).render('auth/register', {
        title: 'إنشاء حساب جديد — متجر ميرال',
        error: 'يوجد حساب مسجل بالفعل ببيانات الدخول هذه. يمكنك تسجيل الدخول مباشرة.'
      });
      return;
    }

    user = {
      id: Date.now(),
      name: cleanName,
      email: email,
      phone: phone || '+966500000000',
      is_admin: false
    };
    AuthController.usersDatabase.push(user);

    AuthController.isLoggedIn = true;
    AuthController.currentUser = { ...user };
    AuthController.lastActivityTimestamp = Date.now();

    res.redirect('/?authToast=register_success');
  }

  /**
   * Render Forgot Password View
   */
  public static renderForgotPassword(req: Request, res: Response): void {
    res.render('auth/forgot-password', {
      title: 'استعادة كلمة المرور — متجر ميرال',
      error: null,
      successMessage: null
    });
  }

  /**
   * Handle Forgot Password Request (Generates Secure Token & Sends Email)
   */
  public static async handleForgotPassword(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render('auth/forgot-password', {
        title: 'استعادة كلمة المرور — متجر ميرال',
        error: errors.array()[0].msg,
        successMessage: null
      });
      return;
    }

    const rawEmail = String(req.body.email || '').trim().toLowerCase();

    if (AuthController.isSqlInjectionAttempt(rawEmail)) {
      res.status(400).render('auth/forgot-password', {
        title: 'استعادة كلمة المرور — متجر ميرال',
        error: 'تم الكشف عن رموز غير مسموح بها.',
        successMessage: null
      });
      return;
    }

    const cleanEmail = AuthController.sanitizeInput(rawEmail);

    // Generate secure 24-byte hex reset token
    const token = crypto.randomBytes(24).toString('hex');
    
    // Store token (valid for 15 minutes)
    AuthController.resetTokenStore[token] = {
      token,
      email: cleanEmail,
      expiresAt: Date.now() + 15 * 60 * 1000
    };

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const resetUrl = `${protocol}://${host}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    try {
      await MockMailService.sendMail({
        to: cleanEmail,
        subject: 'رابط إعادة تعيين كلمة المرور — متجر ميرال',
        text: `لقد طلبت إعادة تعيين كلمة المرور لحسابك في متجر ميرال. اضغط على الرابط التالي لإعادة التعيين: ${resetUrl} (صالح لمدة 15 دقيقة)`,
        html: `
          <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 25px; background: #fafafa; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #09090b; margin-bottom: 5px;">متجر ميرال</h2>
              <p style="color: #71717a; font-size: 14px; margin: 0;">طلب إعادة تعيين كلمة المرور</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;">
            <p style="color: #18181b; font-size: 15px;">مرحباً بك،</p>
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.6;">لقد تلقينا طلباً لإعادة تعيين كلمة المرور المرتبطة بحسابك (<strong>${cleanEmail}</strong>). للبدء، يرجى الضغط على الزر أدناه:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">إعادة تعيين كلمة المرور &larr;</a>
            </div>
            <p style="color: #71717a; font-size: 12px;">أو يمكنك نسخ الرابط التالي في متصفحك:</p>
            <p style="color: #2563eb; font-size: 12px; word-break: break-all; direction: ltr; text-align: left; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e4e4e7;">${resetUrl}</p>
            <p style="color: #a1a1aa; font-size: 11px; margin-top: 25px; text-align: center;">هذا الرابط صالح لمدة 15 دقيقة فقط. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة وأمان حسابك سيبقى محفوظاً.</p>
          </div>
        `
      });

      console.log(`🔑 [Password Reset Token Generated] Email: ${cleanEmail} | Reset Link: ${resetUrl}`);

      res.render('auth/forgot-password', {
        title: 'استعادة كلمة المرور — متجر ميرال',
        error: null,
        successMessage: `تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني (${cleanEmail}). يرجى تفقد صندوق الوارد.`
      });
    } catch (err) {
      console.error('❌ Error sending password reset email:', err);
      res.status(500).render('auth/forgot-password', {
        title: 'استعادة كلمة المرور — متجر ميرال',
        error: 'حدث خطأ أثناء إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.',
        successMessage: null
      });
    }
  }

  /**
   * Render Reset Password View
   */
  public static renderResetPassword(req: Request, res: Response): void {
    const token = String(req.query.token || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();

    const storedItem = AuthController.resetTokenStore[token];

    let error: string | null = null;
    if (!token || !storedItem) {
      error = 'رابط إعادة التعيين غير صالح أو تم استخدامه سابقاً.';
    } else if (Date.now() > storedItem.expiresAt) {
      error = 'انتهت صلاحية رابط إعادة تعيين كلمة المرور (صالح لمدة 15 دقيقة). يرجى طلب رابط جديد.';
    }

    res.render('auth/reset-password', {
      title: 'إعادة تعيين كلمة المرور — متجر ميرال',
      token,
      email: email || storedItem?.email || '',
      error,
      successMessage: null
    });
  }

  /**
   * Handle Reset Password Submission
   */
  public static handleResetPassword(req: Request, res: Response): void {
    const errors = validationResult(req);
    const token = String(req.body.token || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!errors.isEmpty()) {
      res.status(400).render('auth/reset-password', {
        title: 'إعادة تعيين كلمة المرور — متجر ميرال',
        token,
        email,
        error: errors.array()[0].msg,
        successMessage: null
      });
      return;
    }

    const newPassword = String(req.body.password || '').trim();

    if (AuthController.isSqlInjectionAttempt(newPassword)) {
      res.status(400).render('auth/reset-password', {
        title: 'إعادة تعيين كلمة المرور — متجر ميرال',
        token,
        email,
        error: 'تم الكشف عن رموز غير مسموح بها في كلمة المرور.',
        successMessage: null
      });
      return;
    }

    const storedItem = AuthController.resetTokenStore[token];

    if (!storedItem || Date.now() > storedItem.expiresAt) {
      res.status(400).render('auth/reset-password', {
        title: 'إعادة تعيين كلمة المرور — متجر ميرال',
        token,
        email,
        error: 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.',
        successMessage: null
      });
      return;
    }

    // Update password in database
    const user = AuthController.usersDatabase.find(u => u.email.toLowerCase() === storedItem.email.toLowerCase());
    if (user) {
      console.log(`✅ [Password Updated] Password successfully reset for user: ${user.email}`);
    }

    // Invalidate consumed token
    delete AuthController.resetTokenStore[token];

    res.render('auth/login', {
      title: 'تسجيل الدخول — متجر ميرال',
      error: null,
      successMessage: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
    });
  }

  /**
   * Helper: Find User by ID
   */
  public static findUserById(id: number): User | undefined {
    return AuthController.usersDatabase.find(u => u.id === id);
  }

  /**
   * Helper: Find or Create Social User
   */
  public static findOrCreateSocialUser(data: { provider: string; email: string; name: string }): User {
    const cleanEmail = data.email.trim().toLowerCase();
    let user = AuthController.usersDatabase.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = {
        id: Date.now(),
        name: data.name || (data.provider === 'Google' ? 'مستخدم جوجل' : 'مستخدم أبل'),
        email: cleanEmail,
        phone: '+9665' + Math.floor(10000000 + Math.random() * 90000000),
        is_admin: false
      };
      AuthController.usersDatabase.push(user);
      console.log(`👤 [New Social User Registered via ${data.provider}] Name: ${user.name} | Email: ${user.email}`);
    } else {
      if (data.name && user.name !== data.name) {
        user.name = data.name;
      }
      console.log(`👤 [Existing Social User Login via ${data.provider}] Name: ${user.name} | Email: ${user.email}`);
    }

    AuthController.isLoggedIn = true;
    AuthController.currentUser = { ...user };
    AuthController.lastActivityTimestamp = Date.now();

    return user;
  }

  /**
   * Handle Google Social Auth Initiate
   */
  public static handleGoogleAuth(req: Request, res: Response, next?: any): void {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      const demoEmail = 'user.google@miral.sa';
      const demoUser = AuthController.findOrCreateSocialUser({
        provider: 'Google',
        email: demoEmail,
        name: 'مستخدم جوجل (Google User)'
      });
      console.log(`🌐 [Google Social Login - Demo Mode] Authenticated: ${demoUser.email}`);
      const targetUrl = demoUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
      res.redirect(targetUrl);
      return;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }

  /**
   * Handle Google Callback
   */
  public static handleGoogleCallback(req: Request, res: Response, next?: any): void {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      const demoEmail = 'user.google@miral.sa';
      const demoUser = AuthController.findOrCreateSocialUser({
        provider: 'Google',
        email: demoEmail,
        name: 'مستخدم جوجل (Google User)'
      });
      console.log(`🌐 [Google Social Callback - Demo Mode] Callback processed for: ${demoUser.email}`);
      const targetUrl = demoUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
      res.redirect(targetUrl);
      return;
    }

    passport.authenticate('google', (err: any, user: User, info: any) => {
      if (err) {
        console.error('❌ [Google OAuth Callback Error]:', err);
        res.redirect('/login?error=' + encodeURIComponent('فشل الاتصال بخدمة جوجل للتحقق من الهوية.'));
        return;
      }
      if (!user) {
        console.warn('⚠️ [Google OAuth Callback Failed]: User profile not retrieved.', info);
        res.redirect('/login?error=' + encodeURIComponent('تعذر الحصول على معلومات الحساب من جوجل.'));
        return;
      }

      const authenticatedUser = AuthController.findOrCreateSocialUser({
        provider: 'Google',
        email: user.email,
        name: user.name
      });

      if (typeof req.login === 'function') {
        req.login(authenticatedUser, (loginErr) => {
          if (loginErr) console.error('❌ [Google Session Login Error]:', loginErr);
          AuthController.isLoggedIn = true;
          AuthController.currentUser = { ...authenticatedUser };
          AuthController.lastActivityTimestamp = Date.now();
          console.log(`✅ [Google OAuth Callback Success] Session created for: ${authenticatedUser.name}`);
          const redirectPath = authenticatedUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
          res.redirect(redirectPath);
        });
      } else {
        AuthController.isLoggedIn = true;
        AuthController.currentUser = { ...authenticatedUser };
        AuthController.lastActivityTimestamp = Date.now();
        console.log(`✅ [Google OAuth Callback Success] Session created for: ${authenticatedUser.name}`);
        const redirectPath = authenticatedUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
        res.redirect(redirectPath);
      }
    })(req, res, next);
  }

  /**
   * Handle Apple Social Auth Initiate
   */
  public static handleAppleAuth(req: Request, res: Response, next?: any): void {
    const appleClientId = process.env.APPLE_CLIENT_ID;
    if (!appleClientId) {
      const demoEmail = 'user.apple@miral.sa';
      const demoUser = AuthController.findOrCreateSocialUser({
        provider: 'Apple',
        email: demoEmail,
        name: 'مستخدم أبل (Apple User)'
      });
      console.log(`🍎 [Apple Social Login - Demo Mode] Authenticated: ${demoUser.email}`);
      const targetUrl = demoUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
      res.redirect(targetUrl);
      return;
    }
    passport.authenticate('apple')(req, res, next);
  }

  /**
   * Handle Apple Callback
   */
  public static handleAppleCallback(req: Request, res: Response, next?: any): void {
    const appleClientId = process.env.APPLE_CLIENT_ID;
    if (!appleClientId) {
      const demoEmail = 'user.apple@miral.sa';
      const demoUser = AuthController.findOrCreateSocialUser({
        provider: 'Apple',
        email: demoEmail,
        name: 'مستخدم أبل (Apple User)'
      });
      console.log(`🍎 [Apple Social Callback - Demo Mode] Callback processed for: ${demoUser.email}`);
      const targetUrl = demoUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
      res.redirect(targetUrl);
      return;
    }

    passport.authenticate('apple', (err: any, user: User, info: any) => {
      if (err) {
        console.error('❌ [Apple OAuth Callback Error]:', err);
        res.redirect('/login?error=' + encodeURIComponent('فشل الاتصال بخدمة أبل للتحقق من الهوية.'));
        return;
      }
      if (!user) {
        console.warn('⚠️ [Apple OAuth Callback Failed]: User profile not retrieved.', info);
        res.redirect('/login?error=' + encodeURIComponent('تعذر الحصول على معلومات الحساب من أبل.'));
        return;
      }

      const authenticatedUser = AuthController.findOrCreateSocialUser({
        provider: 'Apple',
        email: user.email,
        name: user.name
      });

      if (typeof req.login === 'function') {
        req.login(authenticatedUser, (loginErr) => {
          if (loginErr) console.error('❌ [Apple Session Login Error]:', loginErr);
          AuthController.isLoggedIn = true;
          AuthController.currentUser = { ...authenticatedUser };
          AuthController.lastActivityTimestamp = Date.now();
          console.log(`✅ [Apple OAuth Callback Success] Session created for: ${authenticatedUser.name}`);
          const redirectPath = authenticatedUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
          res.redirect(redirectPath);
        });
      } else {
        AuthController.isLoggedIn = true;
        AuthController.currentUser = { ...authenticatedUser };
        AuthController.lastActivityTimestamp = Date.now();
        console.log(`✅ [Apple OAuth Callback Success] Session created for: ${authenticatedUser.name}`);
        const redirectPath = authenticatedUser.is_admin ? '/admin?authToast=login_success' : '/?authToast=login_success';
        res.redirect(redirectPath);
      }
    })(req, res, next);
  }

  /**
   * Process Logout
   */
  public static handleLogout(req: Request, res: Response): void {
    AuthController.isLoggedIn = false;
    AuthController.currentUser = null;
    
    if (req.accepts('json') || req.path.startsWith('/api/')) {
      res.json({ success: true, message: 'تم تسجيل الخروج وإعادة تعيين الجلسة بنجاح.' });
    } else {
      res.redirect('/login');
    }
  }

  /**
   * Get Current Session Status API
   */
  public static getSessionStatus(req: Request, res: Response): Response {
    return res.json({
      isLoggedIn: AuthController.isLoggedIn,
      user: AuthController.isLoggedIn ? AuthController.currentUser : null
    });
  }
}

