import axios, { AxiosError } from 'axios';

export interface SallaProductCategory {
  id: number;
  name: string;
}

export interface SallaProduct {
  id: number;
  name: string;
  sku?: string;
  price?: { amount: number; currency: string } | number;
  sale_price?: { amount: number; currency: string } | number | null;
  regular_price?: { amount: number; currency: string } | number;
  main_image?: string;
  images?: Array<{ url: string }>;
  category?: SallaProductCategory;
  quantity?: number;
  stock?: number;
  rating?: { stars: number; count: number };
  description?: string;
  promotion?: { title?: string; sub_title?: string };
  created_at?: string;
  status?: string;
}

export interface UnifiedProduct {
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
  source: 'salla' | 'local';
}

export interface SallaSyncStatus {
  connected: boolean;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  sallaProductsCount: number;
  message: string;
  lastError: string | null;
  lastErrorCode: string | null;
  clientId: string | null;
}

class SallaService {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private authUrl: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private lastSyncTime: string | null = null;
  private cachedSallaProducts: UnifiedProduct[] = [];
  private lastError: string | null = null;
  private lastErrorCode: string | null = null;

  constructor() {
    this.clientId = process.env.SALLA_CLIENT_ID || '';
    this.clientSecret = process.env.SALLA_CLIENT_SECRET || '';
    this.baseUrl = process.env.SALLA_API_URL || 'https://api.salla.dev/admin/v2';
    this.authUrl = process.env.SALLA_AUTH_URL || 'https://accounts.salla.sa/oauth2/token';
  }

  /**
   * Helper to delay execution for backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to convert Axios/Network errors into user-friendly Arabic error messages
   */
  public parseApiError(err: unknown): { message: string; code: string; isAuthError: boolean; isNetworkError: boolean } {
    const error = err as AxiosError<{ error?: string; error_description?: string; message?: string }>;
    
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          message: 'انتهت مهلة الاتصال مع خادم سلة. يرجى التحقق من جودة الاتصال بالإنترنت وإعادة المحاولة.',
          code: 'NETWORK_TIMEOUT',
          isAuthError: false,
          isNetworkError: true,
        };
      }
      return {
        message: 'فشل الاتصال الشبكي مع منصة سلة Salla. يرجى التأكد من توفر الخدمة وإعادة المحاولة.',
        code: 'NETWORK_ERROR',
        isAuthError: false,
        isNetworkError: true,
      };
    }

    const status = error.response.status;
    const responseData = error.response.data;

    if (status === 401 || status === 403) {
      return {
        message: 'خطأ في المصادقة مع منصة سلة: مفاتيح SALLA_CLIENT_ID أو SALLA_CLIENT_SECRET غير صحيحة أو تم إلغاء صلاحيتها.',
        code: 'AUTH_FAILED',
        isAuthError: true,
        isNetworkError: false,
      };
    }

    if (status === 429) {
      return {
        message: 'تجاوز الحد المسموح به للطلبات (Rate Limit) لدى منصة سلة. تم تفعيل نظام الانتظار وإعادة المحاولة.',
        code: 'RATE_LIMIT_EXCEEDED',
        isAuthError: false,
        isNetworkError: true,
      };
    }

    if (status >= 500) {
      return {
        message: `واجهة منصة سلة تواجه مشكلة داخلية (رمز الخطأ: ${status}). جاري إعادة المحاولة تلقائياً.`,
        code: 'SERVER_ERROR',
        isAuthError: false,
        isNetworkError: true,
      };
    }

    const serverMsg = responseData?.error_description || responseData?.message || responseData?.error;
    return {
      message: serverMsg ? `خطأ من خادم سلة: ${serverMsg}` : 'حدث خطأ غير متوقع أثناء الاتصال بمنصة سلة.',
      code: `HTTP_${status}`,
      isAuthError: false,
      isNetworkError: false,
    };
  }

  /**
   * Execute request with automatic retry and exponential backoff
   */
  private async executeWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastErr: unknown;
    let delayMs = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 [SallaService] Retrying ${operationName} ( المحاولة ${attempt} من ${maxRetries} )...`);
        }
        const result = await operation();
        this.lastError = null;
        this.lastErrorCode = null;
        return result;
      } catch (err: unknown) {
        lastErr = err;
        const parsed = this.parseApiError(err);
        this.lastError = parsed.message;
        this.lastErrorCode = parsed.code;

        console.warn(`⚠️ [SallaService] ${operationName} (المحاولة ${attempt}/${maxRetries}) فشلت: ${parsed.message}`);

        // If it's an Auth Error, clear token cache so next attempt refreshes token
        if (parsed.isAuthError) {
          this.cachedAccessToken = null;
          this.tokenExpiresAt = 0;
          // Auth errors will not improve by simple retrying without credential fix, break early unless first retry
          if (attempt >= 2) break;
        }

        // Retry if network or server error or rate limit
        if (attempt < maxRetries) {
          await this.delay(delayMs);
          delayMs = Math.round(delayMs * 1.5);
        }
      }
    }

    throw lastErr;
  }

  /**
   * Check if credentials exist in environment
   */
  public hasCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth 2.0 Access Token using Client Credentials flow with automatic retry
   */
  public async getAccessToken(): Promise<string | null> {
    // Return cached token if valid
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    if (!this.hasCredentials()) {
      this.lastError = 'مفاتيح SALLA_CLIENT_ID و SALLA_CLIENT_SECRET غير متوفرة في بيئة النظام.';
      this.lastErrorCode = 'MISSING_CREDENTIALS';
      console.warn('⚠️ [SallaService] SALLA_CLIENT_ID or SALLA_CLIENT_SECRET is missing from environment.');
      return null;
    }

    try {
      return await this.executeWithRetry('Get Access Token', async () => {
        console.log('🔑 [SallaService] Requesting access token from Salla OAuth API...');
        
        const response = await axios.post(
          this.authUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (response.data && response.data.access_token) {
          this.cachedAccessToken = response.data.access_token;
          const expiresIn = response.data.expires_in || 14400; // Default 4 hours
          this.tokenExpiresAt = Date.now() + expiresIn * 1000;
          console.log('✅ [SallaService] Successfully retrieved Salla access token.');
          return this.cachedAccessToken;
        }

        throw new Error('Invalid OAuth response structure from Salla API');
      }, 2, 1000);
    } catch (err: unknown) {
      const parsed = this.parseApiError(err);
      console.error('❌ [SallaService] Error fetching Salla access token:', parsed.message);
      return null;
    }
  }

  /**
   * Transform a raw Salla product item into unified store product format
   */
  public formatSallaProduct(item: SallaProduct): UnifiedProduct {
    const rawPrice = typeof item.price === 'object' ? item.price?.amount : item.price;
    const rawSalePrice = typeof item.sale_price === 'object' ? item.sale_price?.amount : item.sale_price;
    const rawRegularPrice = typeof item.regular_price === 'object' ? item.regular_price?.amount : item.regular_price;

    const finalPrice = Number(rawRegularPrice || rawPrice || 100);
    const finalSalePrice = rawSalePrice ? Number(rawSalePrice) : null;

    let imageUrl = item.main_image || (item.images && item.images[0]?.url) || '';
    if (!imageUrl || !imageUrl.startsWith('http')) {
      imageUrl = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80';
    }

    return {
      id: Number(item.id),
      name: item.name || 'منتج سلة',
      slug: item.sku ? `salla-${item.sku}` : `salla-product-${item.id}`,
      price: finalPrice,
      sale_price: finalSalePrice,
      thumbnail_url: imageUrl,
      category: {
        id: item.category?.id || 1,
        name: item.category?.name || 'عام',
      },
      stock: item.quantity ?? item.stock ?? 10,
      reviews_avg_rating: item.rating?.stars || 4.8,
      reviews_count: item.rating?.count || 15,
      description: item.description || item.promotion?.title || 'منتج مستورد تلقائياً من منصة سلة Salla',
      created_at: item.created_at ? item.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
      source: 'salla',
    };
  }

  /**
   * Fetch products from Salla Merchant API with automatic retries and error parsing
   */
  public async fetchProductsFromSalla(params?: {
    page?: number;
    per_page?: number;
    category_id?: number;
    keyword?: string;
  }): Promise<UnifiedProduct[]> {
    const token = await this.getAccessToken();

    if (!token) {
      console.log('ℹ️ [SallaService] No valid access token available. Returning cached or local Salla items.');
      return this.cachedSallaProducts;
    }

    try {
      return await this.executeWithRetry('Fetch Salla Products', async () => {
        console.log('🛍️ [SallaService] Fetching inventory from Salla Merchant API...');

        const response = await axios.get(`${this.baseUrl}/products`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          params: {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            category_id: params?.category_id,
            keyword: params?.keyword,
          },
          timeout: 10000,
        });

        const rawItems = response.data?.data || [];
        if (Array.isArray(rawItems)) {
          const formatted = rawItems.map(item => this.formatSallaProduct(item));
          this.cachedSallaProducts = formatted;
          this.lastSyncTime = new Date().toLocaleString('ar-SA');
          this.lastError = null;
          this.lastErrorCode = null;
          console.log(`✅ [SallaService] Successfully fetched and formatted ${formatted.length} products from Salla API.`);
          return formatted;
        }

        return this.cachedSallaProducts;
      }, 3, 1000);
    } catch (err: unknown) {
      const parsed = this.parseApiError(err);
      this.lastError = parsed.message;
      this.lastErrorCode = parsed.code;
      console.error('❌ [SallaService] Failed to fetch products from Salla API after retries:', parsed.message);
      return this.cachedSallaProducts;
    }
  }

  /**
   * Get single product details by ID from Salla API with retry
   */
  public async fetchProductById(id: number | string): Promise<UnifiedProduct | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      return await this.executeWithRetry(`Fetch Product #${id}`, async () => {
        const response = await axios.get(`${this.baseUrl}/products/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        const rawItem = response.data?.data;
        if (rawItem) {
          return this.formatSallaProduct(rawItem);
        }
        return null;
      }, 2, 1000);
    } catch (err: unknown) {
      const parsed = this.parseApiError(err);
      console.error(`❌ [SallaService] Failed to fetch product #${id} from Salla API:`, parsed.message);
      return null;
    }
  }

  /**
   * Get Salla API Integration Sync Status
   */
  public async getSyncStatus(): Promise<SallaSyncStatus> {
    const hasCreds = this.hasCredentials();
    const token = hasCreds ? await this.getAccessToken() : null;

    const maskedClientId = this.clientId
      ? `${this.clientId.substring(0, 4)}...${this.clientId.substring(this.clientId.length - 3)}`
      : null;

    let message = token
      ? 'تم الاتصال بنجاح بـ Salla Merchant API واستيراد المنتجات'
      : hasCreds
      ? (this.lastError || 'فشل التحقق من مفاتيح SALLA_CLIENT_ID / SALLA_CLIENT_SECRET مع السيرفر')
      : 'مفاتيح SALLA_CLIENT_ID غير متوفرة في بيئة النظام';

    return {
      connected: Boolean(token),
      hasCredentials: hasCreds,
      lastSyncAt: this.lastSyncTime,
      sallaProductsCount: this.cachedSallaProducts.length,
      message,
      lastError: this.lastError,
      lastErrorCode: this.lastErrorCode,
      clientId: maskedClientId,
    };
  }
}

export const sallaService = new SallaService();
