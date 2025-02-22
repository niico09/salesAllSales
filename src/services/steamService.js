const axios = require('axios');
const Game = require('../models/Game');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class SteamService {
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
            const response = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
            
            if (response.data[appid] && response.data[appid].success) {
                const gameData = response.data[appid].data;
                
                if (['game', 'games', 'dlc', 'package'].includes(gameData.type)) {
                    return {
                        appid,
                        type: gameData.type,
                        name: gameData.name,
                        required_age: gameData.required_age || 0,
                        developers: gameData.developers || [],
                        publishers: gameData.publishers || [],
                        packages: gameData.packages || [],
                        platforms: gameData.platforms || {},
                        genres: (gameData.genres || []).map(g => g.description),
                        dlc: gameData.dlc || [],
                        header_image: gameData.header_image || '',
                        website: gameData.website || ''
                    };
                }
            }
            return null;
        } catch (error) {
            console.error(`Error fetching details for game ${appid}:`, error.message);
            return null;
        }
    }
}

module.exports = new SteamService();
