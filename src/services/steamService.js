const axios = require('axios');
const NodeCache = require('node-cache');
const { STEAM_TYPES, STEAM_FILTERS } = require('../config/steamConstants');
const logger = require('../utils/logger');

class SteamService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600,
      useClones: false
    });

    this.requestDelay = parseInt(process.env.STEAM_API_DELAY || '1000', 10);
    this.maxRetries = parseInt(process.env.STEAM_API_MAX_RETRIES || '3', 10);
    this.retryDelay = parseInt(process.env.STEAM_API_RETRY_DELAY || '2000', 10);
    this.logger = logger;
    this.lastRequestTime = 0;
    this.storeApiRateLimit = parseInt(process.env.STEAM_STORE_API_RATE_LIMIT || '1500', 10);
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.consecutiveRateLimitErrors = 0;
    this.baseRateLimit = parseInt(process.env.STEAM_STORE_API_RATE_LIMIT || '1500', 10);
    this.maxRateLimit = 30000;
    this.cooldownPeriod = 0;
    this.lastRateLimitErrorTime = 0;

    this.api = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'application/json, text/plain, */*',
        Connection: 'keep-alive'
      }
    });

    this.api.interceptors.response.use(
      (response) => {
        if (this.consecutiveRateLimitErrors > 0 && Date.now() - this.lastRateLimitErrorTime > 60000) {
          this.consecutiveRateLimitErrors = Math.max(0, this.consecutiveRateLimitErrors - 1);
          this.adjustRateLimit();
          this.logger.info(`Reducing rate limit to ${this.storeApiRateLimit}ms after successful request`);
        }
        return response;
      },
      async (error) => {
        const { config, response } = error;

        if (response && response.status === 429) {
          this.lastRateLimitErrorTime = Date.now();
          this.consecutiveRateLimitErrors += 1;
          this.adjustRateLimit();
          
          if (this.consecutiveRateLimitErrors >= 5) {
            const cooldownMinutes = Math.min(5, Math.floor(this.consecutiveRateLimitErrors / 5));
            this.cooldownPeriod = 60000 * cooldownMinutes;
            this.logger.warn(
              `Too many rate limit errors (${this.consecutiveRateLimitErrors}). Cooldown: ${cooldownMinutes} min`
            );
            await this.sleep(this.cooldownPeriod);
            this.cooldownPeriod = 0;
          }
          
          this.logger.warn(
            `Rate limit exceeded (429). Limit: ${this.storeApiRateLimit}ms. Errors: ${this.consecutiveRateLimitErrors}`
          );

          if (!config || !config.retry) {
            return Promise.reject(error);
          }

          if (config.retryCount >= this.maxRetries) {
            return Promise.reject(
              new Error(`Maximum retries (${this.maxRetries}) exceeded due to rate limiting`)
            );
          }

          config.retryCount = config.retryCount || 0;
          config.retryCount += 1;

          const delay = this.retryDelay * (8 ** (config.retryCount - 1));
          this.logger.warn(
            `Retrying rate-limited request (${config.retryCount}/${this.maxRetries}) after ${delay}ms`
          );

          await this.sleep(delay);
          return this.api(config);
        }

        if (response && (response.status === 404 || response.status === 403)) {
          return Promise.reject(error);
        }

        if (!config || !config.retry) {
          return Promise.reject(error);
        }

        if (config.retryCount >= this.maxRetries) {
          return Promise.reject(new Error(`Maximum retries (${this.maxRetries}) exceeded`));
        }

        config.retryCount = config.retryCount || 0;
        config.retryCount += 1;

        const delay = this.retryDelay * 2 ** (config.retryCount - 1);
        this.logger.warn(
          `Retrying request to ${config.url} (attempt ${config.retryCount}/${this.maxRetries}) after ${delay}ms`
        );

        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        return this.api(config);
      }
    );
  }

  adjustRateLimit() {
    const multiplier = Math.min(20, 2 ** this.consecutiveRateLimitErrors);
    this.storeApiRateLimit = this.baseRateLimit * multiplier;
    if (this.storeApiRateLimit > this.maxRateLimit) {
      this.storeApiRateLimit = this.maxRateLimit;
    }
  }

  withRetry(config) {
    this.logger.debug(`Configurando retry para ${config.url}`);
    return {
      ...config,
      retry: true,
      retryCount: 0
    };
  }

  async delay() {
    return new Promise((resolve) => {
      setTimeout(resolve, this.requestDelay);
    });
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeElapsed = now - this.lastRequestTime;

    if (timeElapsed < this.storeApiRateLimit) {
      const waitTime = this.storeApiRateLimit - timeElapsed;
      this.logger.debug(
        `Rate limit: Waiting ${waitTime}ms before next request (current limit: ${this.storeApiRateLimit}ms)`
      );
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  async sleep(ms) {
    this.logger.debug(`Sleeping for ${ms}ms to respect rate limits`);
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async processRequestQueue() {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    const processItem = async () => {
      if (this.requestQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      const { config, resolve, reject } = this.requestQueue.shift();

      try {
        await this.enforceRateLimit();
        const response = await this.api(config);
        resolve(response);
      } catch (error) {
        reject(error);
      }

      await processItem();
    };

    await processItem();
  }

  startQueueProcessing() {
    this.processRequestQueue().catch((err) => {
      this.logger.error(`Error processing request queue: ${err.message}`);
    });
  }

  queueRequest(config) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ config, resolve, reject });
      this.startQueueProcessing();
    });
  }

  async getGamesList() {
    const cacheKey = 'steam_games_list';

    const cachedGames = this.cache.get(cacheKey);
    if (cachedGames) {
      this.logger.info('Retrieved games list from cache');
      return cachedGames;
    }

    try {
      this.logger.info('Fetching games list from Steam API');
      const response = await this.api.get(
        `https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`,
        this.withRetry({})
      );

      if (!response.data || !response.data.applist || !response.data.applist.apps) {
        throw new Error('Invalid response format from Steam API');
      }

      const filteredGames = response.data.applist.apps.filter((game) => game.name
                && game.name.trim() !== ''
                && !game.name.toLowerCase().includes('test')
                && !game.name.toLowerCase().includes('demo'));

      this.cache.set(cacheKey, filteredGames);
      this.logger.info(`Retrieved ${filteredGames.length} games from Steam API`);

      return filteredGames;
    } catch (error) {
      this.logger.error(`Error fetching games list: ${error.message}`);
      throw new Error(`Failed to fetch games list: ${error.message}`);
    }
  }

  async getGameDetails(appid, name) {
    if (!appid) {
      this.logger.error('Invalid appid provided to getGameDetails');
      return null;
    }

    const cacheKey = `game_details_${appid}`;

    const cachedDetails = this.cache.get(cacheKey);
    if (cachedDetails) {
      this.logger.info(`Retrieved details for game ${appid} from cache`);
      return cachedDetails;
    }

    if (this.cooldownPeriod > 0) {
      this.logger.info('In cooldown period. Waiting before making new requests.');
      await this.sleep(5000);
    }

    try {
      await this.delay();

      this.logger.info(`Fetching details for game ${name || appid} (${appid})`);

      const response = await this.queueRequest(
        this.withRetry({
          url: `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`,
          method: 'GET'
        })
      );

      if (!response.data || !response.data[appid]) {
        throw new Error('Invalid response from Steam API');
      }

      const gameData = response.data[appid];

      if (!gameData.success) {
        this.logger.warn(`No data available for game ${name || appid} (${appid}), success: false`);
        return { blacklist: true, reason: 'success_false' };
      }

      const { data } = gameData;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid game data structure');
      }

      const processedData = this._processGameData(appid, name, data);

      this.cache.set(cacheKey, processedData, 1800);

      return processedData;
    } catch (error) {
      this.logger.error(`Error getting details for game ${appid}: ${error.message}`);
      return null;
    }
  }

  _processGameData(appid, name, data) {
    const isMainType = STEAM_FILTERS.VALID_TYPES.includes(data.type);
    const isFree = data.is_free || false;

    const metacritic = this._processMetacriticData(data.metacritic);
    const recommendations = this._processRecommendationsData(data.recommendations);
    const price = !isFree ? this._processPriceData(data.price_overview) : null;

    let requiredAge = 0;
    if (data.required_age !== undefined) {
      if (typeof data.required_age === 'number') {
        requiredAge = data.required_age;
      } else if (typeof data.required_age === 'string') {
        const parsedAge = parseInt(data.required_age, 10);
        if (!Number.isNaN(parsedAge)) {
          requiredAge = parsedAge;
        } else {
          this.logger.warn(`Invalid required_age value for game ${name} (${appid}): ${data.required_age}`);
        }
      }
    }

    return {
      appid,
      type: data.type || STEAM_TYPES.UNKNOWN,
      isMainType,
      is_free: isFree,
      name: data.name || name,
      required_age: requiredAge,
      developers: data.developers || [],
      publishers: data.publishers || [],
      packages: data.packages || [],
      platforms: data.platforms || {},
      genres: (data.genres || []).map((g) => g.description),
      dlc: data.dlc || [],
      header_image: data.header_image || '',
      website: data.website || '',
      metacritic,
      recommendations,
      price,
      lastUpdated: new Date()
    };
  }

  _processMetacriticData(metacriticData) {
    this.logger.debug('Procesando datos de Metacritic');
    if (!metacriticData) {
      return {
        score: null,
        url: null
      };
    }

    return {
      score: metacriticData.score || null,
      url: metacriticData.url || null
    };
  }

  _processRecommendationsData(recommendationsData) {
    this.logger.debug('Procesando datos de recomendaciones');
    if (!recommendationsData) {
      return {
        total: 0
      };
    }

    return {
      total: recommendationsData.total || 0
    };
  }

  _processPriceData(priceOverview) {
    this.logger.debug('Procesando datos de precio');
    if (!priceOverview) return null;

    return {
      currency: priceOverview.currency,
      initial: priceOverview.initial ? priceOverview.initial / 100 : null,
      final: priceOverview.final ? priceOverview.final / 100 : null,
      discountPercent: priceOverview.discount_percent || 0,
      initialFormatted: priceOverview.initial_formatted || '',
      finalFormatted: priceOverview.final_formatted || '',
      lastChecked: new Date()
    };
  }

  clearCache() {
    this.cache.flushAll();
    this.logger.info('Steam service cache cleared');
  }
}

module.exports = new SteamService();
