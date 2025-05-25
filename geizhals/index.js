"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeizhalsHelpers = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const user = process.env.GEIZHALS_USERNAME;
const apiKey = process.env.GEIZHALS_API_KEY;
const baseUrl = "https://api.geizhals.net/gh/v9";
class Geizhals {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || baseUrl;
        this.apiKey = config.apiKey || process.env.GEIZHALS_API_KEY || "";
        this.user = config.username || process.env.GEIZHALS_USERNAME || "";
        this.timeout = config.timeout || 30000;
        this.retries = config.retries || 3;
        this.debug = config.debug || process.env.NODE_ENV === "development";
        this.defaultLocation = config.defaultLocation || "de";
        this.defaultLanguage = config.defaultLanguage || "de";
        this.cache = config.cache !== false;
        this.cacheTimeout = config.cacheTimeout || 300000;
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
    getCacheKey(endpoint, data) {
        return `${endpoint}_${JSON.stringify(data)}`;
    }
    isValidCache(timestamp) {
        return Date.now() - timestamp < this.cacheTimeout;
    }
    async makeRequest(endpoint, data, options = {}) {
        const cacheKey = this.getCacheKey(endpoint, data);
        if (this.cache && !options.skipCache && this.requestCache.has(cacheKey)) {
            const cached = this.requestCache.get(cacheKey);
            if (this.isValidCache(cached.timestamp)) {
                if (this.debug) {
                    console.log(`💾 Cache hit for ${endpoint}`);
                }
                return cached.data;
            }
            else {
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
        let lastError = null;
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
                if (this.cache) {
                    this.requestCache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                }
                return result;
            }
            catch (error) {
                lastError = error;
                if (this.debug) {
                    console.log(`❌ Request failed (attempt ${attempt}/${maxRetries}):`, lastError.message);
                }
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        throw new Error(`Request timeout after ${requestTimeout}ms`);
                    }
                    if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
                        throw error;
                    }
                }
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
    async getBestPriceDevelopment(params, options = {}) {
        const mergedParams = {
            loc: this.defaultLocation,
            ...params
        };
        return this.makeRequest("/bestprice_development", { params: mergedParams }, options);
    }
    async getCategories(params = {}, options = {}) {
        const mergedParams = {
            lang: this.defaultLanguage,
            ...params
        };
        return this.makeRequest("/categories", { params: mergedParams }, options);
    }
    async getCategoryList(category, params = {}, options = {}) {
        const mergedParams = {
            lang: this.defaultLanguage,
            loc: this.defaultLocation,
            ...params
        };
        return this.makeRequest("/categorylist", { category, params: mergedParams }, options);
    }
    async queryProduct(query, type = "free", params = {}, options = {}) {
        const mergedParams = {
            lang: this.defaultLanguage,
            loc: this.defaultLocation,
            ...params
        };
        return this.makeRequest("/query_product", { query, type, params: mergedParams }, options);
    }
    async searchProducts(searchTerm, options = {}) {
        const params = {
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
        };
    }
    async getProductById(geizhalsId, options = {}) {
        const params = {
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
        if (response.response && Array.isArray(response.response)) {
            return { ...response, response: response.response[0] };
        }
        return response;
    }
    async getCategoryDeals(categoryId, options = {}) {
        const params = {
            cat: categoryId,
            drop_percentmin: options.minPriceDrop || 5,
            pricemax: options.maxPrice,
            limit: options.limit || 30,
            loc: options.location || this.defaultLocation,
            sort: "pp"
        };
        return this.getBestPriceDevelopment(params, {
            timeout: options.timeout,
            skipCache: options.skipCache
        });
    }
    async getTopDeals(options = {}) {
        const params = {
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
    clearCache() {
        this.requestCache.clear();
        if (this.debug) {
            console.log("🗑️ Cache cleared");
        }
    }
    getCacheStats() {
        return {
            size: this.requestCache.size,
            keys: Array.from(this.requestCache.keys())
        };
    }
    setDebugMode(enabled) {
        this.debug = enabled;
        console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    async testConnection() {
        try {
            if (this.debug) {
                console.log("🔍 Testing API connection...");
            }
            await this.getCategories({ lang: "en" }, { timeout: 5000, skipCache: true });
            if (this.debug) {
                console.log("✅ API connection successful");
            }
            return true;
        }
        catch (error) {
            if (this.debug) {
                console.log("❌ API connection failed:", error);
            }
            return false;
        }
    }
    async debugRequest(endpoint, data) {
        const startTime = Date.now();
        try {
            const response = await this.makeRequest(endpoint, data, { skipCache: true });
            const timing = Date.now() - startTime;
            return {
                success: true,
                response,
                timing
            };
        }
        catch (error) {
            const timing = Date.now() - startTime;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timing
            };
        }
    }
    async batchRequests(requests, options = {}) {
        const concurrency = options.concurrency || 3;
        const delay = options.delayBetweenBatches || 100;
        const results = [];
        if (this.debug) {
            console.log(`🔄 Processing ${requests.length} requests with concurrency ${concurrency}`);
        }
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);
            const batchPromises = batch.map(async (request) => {
                try {
                    const data = await this.makeRequest(request.endpoint, request.data, request.options);
                    return { success: true, data };
                }
                catch (error) {
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
            if (i + concurrency < requests.length && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return results;
    }
}
exports.default = Geizhals;
exports.GeizhalsHelpers = {
    createDevClient(config = {}) {
        return new Geizhals({
            debug: true,
            cache: true,
            cacheTimeout: 60000,
            timeout: 10000,
            retries: 1,
            ...config
        });
    },
    createProdClient(config = {}) {
        return new Geizhals({
            debug: false,
            cache: true,
            cacheTimeout: 300000,
            timeout: 30000,
            retries: 3,
            ...config
        });
    },
    validateConfig(config) {
        const errors = [];
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
    },
    getTestQueries() {
        return [
            { name: "Search iPhone", query: "iPhone", type: "free" },
            { name: "Search Laptop", query: "ThinkPad", type: "free" },
            { name: "Search GPU", query: "RTX 4080", type: "free" },
            { name: "Search by ID", query: "123456", type: "id" }
        ];
    }
};
