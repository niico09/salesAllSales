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

    this.api = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'SalesAllSales/1.0.0'
      }
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config, response } = error;

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

    try {
      await this.delay();

      this.logger.info(`Fetching details for game ${name || appid} (${appid})`);
      const response = await this.api.get(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`,
        this.withRetry({})
      );

      if (!response.data || !response.data[appid]) {
        throw new Error('Invalid response from Steam API');
      }

      const gameData = response.data[appid];

      if (!gameData.success) {
        this.logger.warn(`No data available for game ${name || appid} (${appid})`);
        return null;
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
