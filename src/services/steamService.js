const axios = require('axios');
const NodeCache = require('node-cache');
const Game = require('../models/Game');
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
        
        this.api = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'SalesAllSales/1.0.0'
            }
        });
        
        this.api.interceptors.response.use(
            response => response,
            async error => {
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
                
                const delay = this.retryDelay * Math.pow(2, config.retryCount - 1);
                logger.warn(`Retrying request to ${config.url} (attempt ${config.retryCount}/${this.maxRetries}) after ${delay}ms`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.api(config);
            }
        );
    }

    withRetry(config) {
        return {
            ...config,
            retry: true,
            retryCount: 0
        };
    }

    async delay() {
        return new Promise(resolve => setTimeout(resolve, this.requestDelay));
    }

    async getGamesList() {
        const cacheKey = 'steam_games_list';
        
        const cachedGames = this.cache.get(cacheKey);
        if (cachedGames) {
            logger.info('Retrieved games list from cache');
            return cachedGames;
        }
        
        try {
            logger.info('Fetching games list from Steam API');
            const response = await this.api.get(
                `https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`,
                this.withRetry({})
            );
            
            if (!response.data || !response.data.applist || !response.data.applist.apps) {
                throw new Error('Invalid response format from Steam API');
            }
            
            const filteredGames = response.data.applist.apps.filter(game => 
                game.name && 
                game.name.trim() !== '' && 
                !game.name.toLowerCase().includes('test') &&
                !game.name.toLowerCase().includes('demo')
            );
            
            this.cache.set(cacheKey, filteredGames);
            logger.info(`Retrieved ${filteredGames.length} games from Steam API`);
            
            return filteredGames;
        } catch (error) {
            logger.error(`Error fetching games list: ${error.message}`);
            throw new Error(`Failed to fetch games list: ${error.message}`);
        }
    }

    async getGameDetails(appid, name) {
        if (!appid) {
            logger.error('Invalid appid provided to getGameDetails');
            return null;
        }
        
        const cacheKey = `game_details_${appid}`;
        
        const cachedDetails = this.cache.get(cacheKey);
        if (cachedDetails) {
            logger.info(`Retrieved details for game ${appid} from cache`);
            return cachedDetails;
        }
        
        try {
            await this.delay();
            
            logger.info(`Fetching details for game ${name || appid} (${appid})`);
            const response = await this.api.get(
                `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`,
                this.withRetry({})
            );
            
            if (!response.data || !response.data[appid]) {
                throw new Error('Invalid response from Steam API');
            }

            const gameData = response.data[appid];

            if (!gameData.success) {
                logger.warn(`No data available for game ${name || appid} (${appid})`);
                return null;
            }

            const data = gameData.data;
            
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid game data structure');
            }

            const processedData = this._processGameData(appid, name, data);
            
            this.cache.set(cacheKey, processedData, 1800);
            
            return processedData;
        } catch (error) {
            logger.error(`Error getting details for game ${appid}: ${error.message}`);
            return null;
        }
    }

    _processGameData(appid, name, data) {
        const isMainType = STEAM_FILTERS.VALID_TYPES.includes(data.type);
        const is_free = data.is_free || false;

        const metacritic = this._processMetacriticData(data.metacritic);
        const recommendations = this._processRecommendationsData(data.recommendations);
        const price = !is_free ? this._processPriceData(data.price_overview) : null;

        return {
            appid,
            type: data.type || STEAM_TYPES.UNKNOWN,
            isMainType,
            is_free,
            name: data.name || name,
            required_age: data.required_age || 0,
            developers: data.developers || [],
            publishers: data.publishers || [],
            packages: data.packages || [],
            platforms: data.platforms || {},
            genres: (data.genres || []).map(g => g.description),
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
        if (!priceOverview) return null;

        return {
            currency: priceOverview.currency,
            initial: priceOverview.initial ? priceOverview.initial / 100 : null,
            final: priceOverview.final ? priceOverview.final / 100 : null,
            discount_percent: priceOverview.discount_percent || 0,
            initial_formatted: priceOverview.initial_formatted || '',
            final_formatted: priceOverview.final_formatted || '',
            lastChecked: new Date()
        };
    }
    
    clearCache() {
        this.cache.flushAll();
        logger.info('Steam service cache cleared');
    }
}

module.exports = new SteamService();
