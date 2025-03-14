const axios = require('axios');
const Game = require('../models/Game');
const { STEAM_TYPES, STEAM_FILTERS } = require('../config/steamConstants');
const logger = require('../utils/logger');

/**
 * Utility function to add delay between API calls
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after the delay
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Service for interacting with Steam API
 * @class SteamService
 */
class SteamService {
    constructor() {
    }

    /**
     * Get list of games from Steam API
     * @returns {Promise<Array>} List of games
     */
    async getGamesList() {
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        return response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );
    }

    /**
     * Get detailed information for a game from Steam API
     * Time complexity: O(1) - Single API call with constant processing time
     * @param {number} appid - Steam application ID
     * @param {string} name - Game name
     * @returns {Promise<Object|null>} Game details or null if not found
     */
    async getGameDetails(appid, name) {
        try {
            // Add delay to avoid rate limiting
            await delay(1000);
            
            logger.info(`Fetching details for game ${name} (${appid})`);
            const response = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`);
            
            if (!response.data || !response.data[appid]) {
                throw new Error('Invalid response from Steam API');
            }

            const gameData = response.data[appid];

            if (!gameData.success) {
                logger.warn(`No data available for game ${name} (${appid})`);
                return null;
            }

            const data = gameData.data;
            
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid game data');
            }

            const isMainType = STEAM_FILTERS.VALID_TYPES.includes(data.type);
            const is_free = data.is_free || false;

            // Extract metacritic information if available
            const metacritic = data.metacritic ? {
                score: data.metacritic.score || null,
                url: data.metacritic.url || null
            } : null;

            // Extract recommendations information if available
            const recommendations = data.recommendations ? {
                total: data.recommendations.total || 0
            } : null;

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
                price: !is_free ? this._processPriceData(data.price_overview) : null,
                price_overview: !is_free ? data.price_overview || null : null,
                lastUpdated: new Date()
            };
        } catch (error) {
            logger.error(`Error getting details for game ${appid}: ${error.message}`);
            return null;
        }
    }

    /**
     * Process price data from Steam API
     * @param {Object} priceOverview - Price overview object from Steam API
     * @returns {Object|null} Processed price data or null if not available
     * @private
     */
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
}

module.exports = new SteamService();
