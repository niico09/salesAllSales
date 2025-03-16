const axios = require('axios');
const Game = require('../models/Game');
const { STEAM_TYPES, STEAM_FILTERS } = require('../config/steamConstants');
const logger = require('../utils/logger');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class SteamService {
    constructor() {
    }

    async getGamesList() {
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        return response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );
    }

    async getGameDetails(appid, name) {
        try {
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

            return this._processGameData(appid, name, data);
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
        const steamPrice = !is_free ? this._processPriceData(data.price_overview, 'steam') : null;
        
        // Crear array de precios con el precio de Steam si existe
        const prices = [];
        if (steamPrice) {
            prices.push(steamPrice);
        }

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
            prices,
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

    _processPriceData(priceOverview, platform) {
        if (!priceOverview) return null;

        return {
            platform: platform || 'steam',
            currency: priceOverview.currency,
            initial: priceOverview.initial ? priceOverview.initial / 100 : null,
            final: priceOverview.final ? priceOverview.final / 100 : null,
            discount_percent: priceOverview.discount_percent || 0,
            initial_formatted: priceOverview.initial_formatted || '',
            final_formatted: priceOverview.final_formatted || '',
            lastChecked: new Date()
        };
    }

    // Método para actualizar precios de otras plataformas (a implementar en el futuro)
    async updateXboxPrice(appid, gameTitle) {
        // Implementación futura para obtener precios de Xbox
        logger.info(`Function to get Xbox prices for ${gameTitle} (${appid}) will be implemented in the future`);
        return null;
    }

    async updatePlaystationPrice(appid, gameTitle) {
        // Implementación futura para obtener precios de PlayStation
        logger.info(`Function to get PlayStation prices for ${gameTitle} (${appid}) will be implemented in the future`);
        return null;
    }
}

module.exports = new SteamService();
