const axios = require('axios');
const Game = require('../models/Game');
const GameBlacklist = require('../models/GameBlacklist');
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
            const isBlacklisted = await this._checkIfBlacklisted(appid);
            if (isBlacklisted) {
                logger.info(`Skipping blacklisted game with appid: ${appid}`);
                return null;
            }

            await delay(1000);
            
            logger.info(`Fetching details for game ${name} (${appid})`);
            const response = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`);
            
            if (!response.data || !response.data[appid]) {
                await this._addToBlacklist(appid, 'Invalid response from Steam API');
                throw new Error('Invalid response from Steam API');
            }

            const gameData = response.data[appid];

            if (!gameData.success) {
                logger.warn(`No data available for game ${name} (${appid})`);
                await this._addToBlacklist(appid, 'No data available');
                return null;
            }

            const data = gameData.data;
            
            if (!data || typeof data !== 'object') {
                await this._addToBlacklist(appid, 'Invalid game data');
                throw new Error('Invalid game data');
            }

            return this._processGameData(appid, name, data);
        } catch (error) {
            logger.error(`Error getting details for game ${appid}: ${error.message}`);
            return null;
        }
    }

    async _checkIfBlacklisted(appid) {
        try {
            const blacklistedGame = await GameBlacklist.findOne({ appid });
            return !!blacklistedGame;
        } catch (error) {
            logger.error(`Error checking blacklist for game ${appid}: ${error.message}`);
            return false;
        }
    }

    async _addToBlacklist(appid, reason) {
        try {
            const existingEntry = await GameBlacklist.findOne({ appid });
            if (!existingEntry) {
                await new GameBlacklist({
                    appid,
                    reason,
                    createdAt: new Date()
                }).save();
                logger.info(`Added game ${appid} to blacklist. Reason: ${reason}`);
            }
        } catch (error) {
            logger.error(`Error adding game ${appid} to blacklist: ${error.message}`);
        }
    }

    _processGameData(appid, name, data) {
        const isMainType = STEAM_FILTERS.VALID_TYPES.includes(data.type);
        const is_free = data.is_free || false;

        const metacritic = this._processMetacriticData(data.metacritic);
        const recommendations = this._processRecommendationsData(data.recommendations);
        const steamPrice = !is_free ? this._processPriceData(data.price_overview, 'steam') : null;
        
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

    async updateXboxPrice(appid, gameTitle) {
        logger.info(`Function to get Xbox prices for ${gameTitle} (${appid}) will be implemented in the future`);
        return null;
    }

    async updatePlaystationPrice(appid, gameTitle) {
        logger.info(`Function to get PlayStation prices for ${gameTitle} (${appid}) will be implemented in the future`);
        return null;
    }
}

module.exports = new SteamService();
