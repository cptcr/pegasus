import { config } from "dotenv";
config();

const user = process.env.GEIZHALS_USERNAME;
const apiKey = process.env.GEIZHALS_API_KEY;

const baseUrl = "https://api.geizhals.net/gh/v9";

// Type definitions based on the API documentation
type LanguageCode = "de" | "en" | "pl";
type LocationCode = "at" | "de" | "uk" | "pl" | "eu";
type AvailabilityCode = "e" | "l" | "k";
type ImageSize = "n" | "s" | "t";
type AcquisitionType = "alle" | "v";
type PaymentCalculation = "all" | "best" | "cod" | "cc" | "gc" | "pa" | "pp";
type SortOrder = "artikel" | "t" | "n" | "bew" | "r" | "p" | "eintr" | "lz" | "nbew" | "m" | "none";
type BestPriceSortOrder = "t" | "pp" | "c" | "p" | "p-";
type CategorySortOrder = "t" | "p" | "-p" | "lz";
type Interval = "1d" | "7d" | "31d";

interface DescriptionData {
  prop: string;
  value: string;
}

interface ShippingData {
  shipping_option: string;
  shipping_price: number;
}

interface ShippingDataPerCountry {
  b?: ShippingData;
  cc?: ShippingData;
  cod?: ShippingData;
  gc?: ShippingData;
  pa?: ShippingData;
  pp?: ShippingData;
}

interface BestPriceDevelopmentData {
  alltime_best?: boolean;
  best_avl: number;
  best_deep_link: string;
  best_price: number;
  cat: string;
  cat_name: string;
  category_path: string;
  change_in_local: number;
  change_in_percent: number;
  description?: DescriptionData[];
  h_id: string;
  hname: string;
  id: number;
  image_thumb: string;
  manufacturer_id: number;
  manufacturer_name: string;
  merchant_logo: string;
  middle_category_id: number;
  middle_category_name: string;
  offer_count: number;
  ppu?: {
    description: string;
  };
  product: string;
  rank: number;
  rating_comments: number;
  rating_count: number;
  rating_percent: number;
  rating_stars: number;
  timestamp: string;
  top_category_id: number;
  top_category_name: string;
  top_deal?: boolean;
}

interface BestPriceDevelopmentParams {
  alltime_best?: boolean;
  cat?: string;
  drop_euromax?: number;
  drop_euromin?: number;
  drop_percentmax?: number;
  drop_percentmin?: number;
  h_id?: number;
  interval?: Interval;
  limit?: number;
  loc?: LocationCode;
  m?: number;
  mfc?: string;
  o?: number;
  price_range?: boolean;
  pricemax?: number;
  pricemin?: number;
  sort?: BestPriceSortOrder;
  top_deal?: boolean;
  v?: number;
}

interface CategoryData {
  childs?: CategoryData[];
  id: Record<string, string>;
  new_filters: boolean;
  thumbs?: any;
  title: string;
}

interface CategoriesParams {
  lang?: LanguageCode;
  m?: number;
}

interface CategoryListParams {
  add_metadata?: boolean;
  add_shortname?: boolean;
  asd?: boolean;
  asuch?: string;
  bpmax?: number;
  bpmin?: number;
  campaignID?: string;
  coop?: boolean;
  deals_as_array?: boolean;
  dist?: string;
  expand_enum?: boolean;
  fcols?: string[];
  filter_search?: string;
  filters_only?: boolean;
  force_filters?: boolean;
  full_enums?: string[];
  hide_deals?: boolean;
  hloc?: LocationCode[];
  inactive_filters?: boolean;
  is_mobile?: boolean;
  lang?: LanguageCode;
  last_added?: string;
  loc?: LocationCode;
  new_filters?: boolean;
  offset?: number;
  omit_description?: boolean;
  pagesize?: number;
  plz?: string;
  preset?: number;
  preset_counts?: boolean;
  price_range?: boolean;
  productratings?: boolean;
  promode?: boolean;
  relative_links?: boolean;
  reverse_order?: boolean;
  sort?: SortOrder;
  t?: AcquisitionType;
  this_filters?: string[];
  v?: AvailabilityCode;
  vl?: string;
  xf?: string;
  zip?: string;
}

interface ProductQueryParams {
  add_asin?: boolean;
  add_popularity?: boolean;
  add_ppu?: boolean;
  add_product_description_teaser?: boolean;
  add_rank?: boolean;
  add_ratings?: boolean;
  amazon_prime?: boolean;
  bestprice_extrema?: boolean;
  calculate_delivery?: PaymentCalculation;
  campaignID?: string;
  dist?: string;
  extra_offers_from_merchant?: number[];
  fetch_variant?: boolean;
  filter_accessories?: boolean;
  hloc?: LocationCode[];
  image_size?: ImageSize;
  in?: number;
  include_offer_ids?: boolean;
  label_accessories?: boolean;
  lang?: LanguageCode;
  latitude?: string;
  loc?: LocationCode;
  longitude?: string;
  merchant_details?: boolean;
  n_offers?: number;
  n_results?: number;
  omit_description?: boolean;
  omit_images?: boolean;
  only_amazon_offers?: boolean;
  pickup_only?: boolean;
  redir_baseurl?: boolean;
  review_details?: boolean;
  search_ngrams_only?: boolean;
  size?: string[];
  skip_promos?: boolean;
  structured?: boolean;
  t?: AcquisitionType;
  test_reviews?: boolean;
  v?: AvailabilityCode;
  votes?: boolean;
  zip?: string;
}

interface QueryProductOffer {
  shop: {
    avl: any;
    descr: string[];
    ecpc?: number;
    loc: string;
    logo: string;
    multimerchant_id?: number;
    name: string;
    ppu?: any;
    price: any;
    pricing: any;
    prod_desc: string[];
    promotion?: any;
    ratings?: any;
    shipping?: ShippingDataPerCountry;
    shipping_text?: any;
    time: string;
    url: string;
  };
}

interface QueryProductResponse {
  accessory_for?: any[];
  asins?: string[];
  bestprices?: {
    max: number;
    min: number;
  };
  bpoffer_link: string;
  category: any[];
  description?: DescriptionData[];
  description_teaser?: string;
  extra_offers?: QueryProductOffer[];
  gtin?: string[];
  gzhid: number;
  images?: string[];
  listed_since: string;
  manufacturer_id: number;
  manufacturer_name: string;
  name: string;
  offer_count?: number;
  offers?: QueryProductOffer[];
  popularity?: string;
  prices?: {
    avg: number;
    best: number;
  };
  rank?: string;
  rating_comments?: number;
  rating_count?: number;
  rating_percent?: number;
  rating_stars?: number;
  urls: {
    manufacturer: string;
    offers: string;
    overview: string;
    pricehist: string;
    rate: string;
    reviews: string;
  };
  variant_count?: number;
  variant_id?: number;
}

interface ErrorResponse {
  code: string;
  context: string;
  error: string;
  retry: boolean;
}

interface ApiResponse<T> {
  response?: T;
  error?: ErrorResponse;
}

interface GeizhalsConfig {
  apiKey?: string;
  username?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
  defaultLocation?: LocationCode;
  defaultLanguage?: LanguageCode;
  cache?: boolean;
  cacheTimeout?: number;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
}

export default class Geizhals {
  private baseUrl: string;
  private apiKey: string;
  private user: string;
  private timeout: number;
  private retries: number;
  private debug: boolean;
  private defaultLocation: LocationCode;
  private defaultLanguage: LanguageCode;
  private cache: boolean;
  private cacheTimeout: number;
  private requestCache: Map<string, { data: any; timestamp: number }>;

  constructor(config: GeizhalsConfig = {}) {
    this.baseUrl = config.baseUrl || baseUrl;
    this.apiKey = config.apiKey || process.env.GEIZHALS_API_KEY || "";
    this.user = config.username || process.env.GEIZHALS_USERNAME || "";
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
    this.debug = config.debug || process.env.NODE_ENV === "development";
    this.defaultLocation = config.defaultLocation || "de";
    this.defaultLanguage = config.defaultLanguage || "de";
    this.cache = config.cache !== false; // enabled by default
    this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes
    this.requestCache = new Map();

    if (!this.apiKey) {
      throw new Error("API key is required. Set GEIZHALS_API_KEY environment variable or pass it to constructor.");
    }

    if (this.debug) {
      console.log("🔧 Geizhals API initialized in debug mode");
      console.log(`📍 Default location: ${this.defaultLocation}`);
      console.log(`🌐 Default language: ${this.defaultLanguage}`);
      console.log(`⚡ Cache enabled: ${this.cache}`);
    }
  }

  private getCacheKey(endpoint: string, data: any): string {
    return `${endpoint}_${JSON.stringify(data)}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  private async makeRequest<T>(
    endpoint: string, 
    data: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint, data);
    
    // Check cache if enabled and not skipped
    if (this.cache && !options.skipCache && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey)!;
      if (this.isValidCache(cached.timestamp)) {
        if (this.debug) {
          console.log(`💾 Cache hit for ${endpoint}`);
        }
        return cached.data;
      } else {
        this.requestCache.delete(cacheKey);
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const requestTimeout = options.timeout || this.timeout;
    const maxRetries = options.retries || this.retries;
    
    if (this.debug) {
      console.log(`🚀 Making request to ${endpoint}`);
      console.log(`📤 Request data:`, JSON.stringify(data, null, 2));
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.debug && attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${endpoint}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
            "User-Agent": "Geizhals-TS-Client/1.0",
            ...(this.user && { "X-User": this.user })
          },
          body: JSON.stringify(data),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(`API Error: ${result.error.error} (${result.error.code})`);
        }

        if (this.debug) {
          console.log(`✅ Success for ${endpoint}`);
          console.log(`📥 Response:`, JSON.stringify(result, null, 2));
        }

        // Cache successful responses
        if (this.cache) {
          this.requestCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
        }

        return result;

      } catch (error) {
        lastError = error as Error;
        
        if (this.debug) {
          console.log(`❌ Request failed (attempt ${attempt}/${maxRetries}):`, lastError.message);
        }

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${requestTimeout}ms`);
          }
          if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
            throw error; // Don't retry client errors
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          if (this.debug) {
            console.log(`⏳ Waiting ${delay}ms before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Request failed after ${maxRetries} attempts`);
  }

  // Best Price Development endpoint
  async getBestPriceDevelopment(
    params: BestPriceDevelopmentParams,
    options: RequestOptions = {}
  ): Promise<ApiResponse<{ 
    deals: BestPriceDevelopmentData[];
    total: number;
    categories?: any;
    manufacturer?: any[];
    merchants?: any[];
    pager?: any;
    price_range?: any;
    boundary_filters?: any;
  }>> {
    const mergedParams = {
      loc: this.defaultLocation,
      ...params
    };
    return this.makeRequest("/bestprice_development", { params: mergedParams }, options);
  }

  // Categories endpoint
  async getCategories(
    params: CategoriesParams = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<CategoryData[]>> {
    const mergedParams = {
      lang: this.defaultLanguage,
      ...params
    };
    return this.makeRequest("/categories", { params: mergedParams }, options);
  }

  // Category List endpoint
  async getCategoryList(
    category: string, 
    params: CategoryListParams = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<any>> {
    const mergedParams = {
      lang: this.defaultLanguage,
      loc: this.defaultLocation,
      ...params
    };
    return this.makeRequest("/categorylist", { category, params: mergedParams }, options);
  }

  // Query Product endpoint
  async queryProduct(
    query: string, 
    type: "id" | "gtin" | "free" | "asin" = "free", 
    params: ProductQueryParams = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<QueryProductResponse | QueryProductResponse[]>> {
    const mergedParams = {
      lang: this.defaultLanguage,
      loc: this.defaultLocation,
      ...params
    };
    return this.makeRequest("/query_product", { query, type, params: mergedParams }, options);
  }

  // Convenience methods for common operations

  /**
   * Search for products by name
   */
  async searchProducts(searchTerm: string, options: {
    limit?: number;
    includeOffers?: boolean;
    location?: LocationCode;
    language?: LanguageCode;
    timeout?: number;
    skipCache?: boolean;
  } = {}): Promise<ApiResponse<QueryProductResponse[]>> {
    const params: ProductQueryParams = {
      n_results: options.limit || 100,
      n_offers: options.includeOffers ? 10 : 0,
      loc: options.location || this.defaultLocation,
      lang: options.language || this.defaultLanguage
    };

    const response = await this.queryProduct(searchTerm, "free", params, {
      timeout: options.timeout,
      skipCache: options.skipCache
    });

    return {
      ...response,
      response: Array.isArray(response.response) ? response.response : [response.response]
    } as ApiResponse<QueryProductResponse[]>;
  }

  /**
   * Get product details by Geizhals ID
   */
  async getProductById(geizhalsId: string | number, options: {
    includeOffers?: boolean;
    numberOfOffers?: number;
    location?: LocationCode;
    language?: LanguageCode;
    timeout?: number;
    skipCache?: boolean;
  } = {}): Promise<ApiResponse<QueryProductResponse>> {
    const params: ProductQueryParams = {
      n_offers: options.includeOffers ? (options.numberOfOffers || 10) : 0,
      loc: options.location || this.defaultLocation,
      lang: options.language || this.defaultLanguage,
      add_ratings: true,
      votes: true
    };

    const response = await this.queryProduct(String(geizhalsId), "id", params, {
      timeout: options.timeout,
      skipCache: options.skipCache
    });

    // Ensure we have a single product response
    if (response.response && Array.isArray(response.response)) {
      return { ...response, response: response.response[0] };
    }
    return response as ApiResponse<QueryProductResponse>;
  }

  /**
   * Get products in a specific category with price drops
   */
  async getCategoryDeals(categoryId: string, options: {
    minPriceDrop?: number;
    maxPrice?: number;
    limit?: number;
    location?: LocationCode;
    timeout?: number;
    skipCache?: boolean;
  } = {}): Promise<ApiResponse<{ deals: BestPriceDevelopmentData[]; total: number }>> {
    const params: BestPriceDevelopmentParams = {
      cat: categoryId,
      drop_percentmin: options.minPriceDrop || 5,
      pricemax: options.maxPrice,
      limit: options.limit || 30,
      loc: options.location || this.defaultLocation,
      sort: "pp" // sort by percent drop descending
    };

    return this.getBestPriceDevelopment(params, {
      timeout: options.timeout,
      skipCache: options.skipCache
    });
  }

  /**
   * Get top deals across all categories
   */
  async getTopDeals(options: {
    limit?: number;
    location?: LocationCode;
    timeout?: number;
    skipCache?: boolean;
  } = {}): Promise<ApiResponse<{ deals: BestPriceDevelopmentData[]; total: number }>> {
    const params: BestPriceDevelopmentParams = {
      top_deal: true,
      limit: options.limit || 30,
      loc: options.location || this.defaultLocation,
      sort: "pp"
    };

    return this.getBestPriceDevelopment(params, {
      timeout: options.timeout,
      skipCache: options.skipCache
    });
  }

  // Development and debugging utilities

  /**
   * Clear the request cache
   */
  clearCache(): void {
    this.requestCache.clear();
    if (this.debug) {
      console.log("🗑️ Cache cleared");
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.requestCache.size,
      keys: Array.from(this.requestCache.keys())
    };
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debug = enabled;
    console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.debug) {
        console.log("🔍 Testing API connection...");
      }
      
      await this.getCategories({ lang: "en" }, { timeout: 5000, skipCache: true });
      
      if (this.debug) {
        console.log("✅ API connection successful");
      }
      
      return true;
    } catch (error) {
      if (this.debug) {
        console.log("❌ API connection failed:", error);
      }
      return false;
    }
  }

  /**
   * Get detailed error information for debugging
   */
  async debugRequest(endpoint: string, data: any): Promise<{
    success: boolean;
    response?: any;
    error?: any;
    timing: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(endpoint, data, { skipCache: true });
      const timing = Date.now() - startTime;
      
      return {
        success: true,
        response,
        timing
      };
    } catch (error) {
      const timing = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timing
      };
    }
  }

  /**
   * Batch multiple requests with automatic retry and rate limiting
   */
  async batchRequests<T>(
    requests: Array<{
      endpoint: string;
      data: any;
      options?: RequestOptions;
    }>,
    options: {
      concurrency?: number;
      delayBetweenBatches?: number;
    } = {}
  ): Promise<Array<{ success: boolean; data?: T; error?: string }>> {
    const concurrency = options.concurrency || 3;
    const delay = options.delayBetweenBatches || 100;
    const results: Array<{ success: boolean; data?: T; error?: string }> = [];
    
    if (this.debug) {
      console.log(`🔄 Processing ${requests.length} requests with concurrency ${concurrency}`);
    }

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (request) => {
        try {
          const data = await this.makeRequest<T>(
            request.endpoint, 
            request.data, 
            request.options
          );
          return { success: true, data };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (this.debug) {
        console.log(`✅ Completed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(requests.length / concurrency)}`);
      }

      // Add delay between batches
      if (i + concurrency < requests.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }
}

// Export types for use by consumers
export type {
  BestPriceDevelopmentData,
  BestPriceDevelopmentParams,
  CategoryData,
  CategoriesParams,
  CategoryListParams,
  ProductQueryParams,
  QueryProductResponse,
  QueryProductOffer,
  ErrorResponse,
  ApiResponse,
  LanguageCode,
  LocationCode,
  AvailabilityCode,
  GeizhalsConfig,
  RequestOptions
};

// Development helper functions
export const GeizhalsHelpers = {
  /**
   * Create a development-optimized client instance
   */
  createDevClient(config: Partial<GeizhalsConfig> = {}): Geizhals {
    return new Geizhals({
      debug: true,
      cache: true,
      cacheTimeout: 60000, // 1 minute cache for development
      timeout: 10000, // 10 second timeout
      retries: 1, // Fewer retries in development
      ...config
    });
  },

  /**
   * Create a production-optimized client instance
   */
  createProdClient(config: Partial<GeizhalsConfig> = {}): Geizhals {
    return new Geizhals({
      debug: false,
      cache: true,
      cacheTimeout: 300000, // 5 minute cache
      timeout: 30000, // 30 second timeout
      retries: 3, // More retries in production
      ...config
    });
  },

  /**
   * Validate API configuration
   */
  validateConfig(config: GeizhalsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.apiKey && !process.env.GEIZHALS_API_KEY) {
      errors.push("API key is required");
    }

    if (config.timeout && config.timeout < 1000) {
      errors.push("Timeout should be at least 1000ms");
    }

    if (config.retries && (config.retries < 0 || config.retries > 10)) {
      errors.push("Retries should be between 0 and 10");
    }

    if (config.cacheTimeout && config.cacheTimeout < 0) {
      errors.push("Cache timeout should be positive");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Common category IDs for quick access
   */
  categories: {
    SMARTPHONES: "handy",
    LAPTOPS: "nb",
    PROCESSORS_INTEL: "cpu1151", 
    PROCESSORS_AMD: "cpuamdam4",
    GRAPHICS_CARDS: "vga256",
    MOTHERBOARDS: "mb1151",
    RAM: "ramddr4",
    STORAGE_SSD: "sm_class0",
    MONITORS: "monlcd",
    TABLETS: "tablet"
  } as const,

  /**
   * Generate test queries for development
   */
  getTestQueries(): Array<{ name: string; query: string; type: "id" | "gtin" | "free" | "asin" }> {
    return [
      { name: "Search iPhone", query: "iPhone", type: "free" },
      { name: "Search Laptop", query: "ThinkPad", type: "free" },
      { name: "Search GPU", query: "RTX 4080", type: "free" },
      { name: "Search by ID", query: "123456", type: "id" }
    ];
  }
};