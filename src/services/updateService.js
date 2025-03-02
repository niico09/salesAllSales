const cron = require('node-cron');
const Game = require('../models/Game');
const SteamService = require('./steamService');

class UpdateService {
    constructor() {
        this.requestDelay = 1000;
    }

    async updateGameDetails(game) {
        try {
            const updatedGameData = await SteamService.getGameDetails(game.appid);
            if (updatedGameData) {
                if (this.hasPriceChanged(game, updatedGameData)) {
                    if (game.price) {
                        if (!game.priceHistory) game.priceHistory = [];
                        game.priceHistory.push(game.price);
                    }
                }

                Object.assign(game, updatedGameData);
                game.lastUpdated = new Date();
                await game.save();
                console.log(`Juego actualizado exitosamente: ${game.name} (${game.appid})`);
            }
        } catch (error) {
            console.error(`Error actualizando el juego ${game.appid}:`, error.message);
        }
    }

    hasPriceChanged(oldGame, newGame) {
        if (!oldGame.price_overview && !newGame.price_overview) return false;
        if (!oldGame.price_overview || !newGame.price_overview) return true;
        
        return oldGame.price_overview.final !== newGame.price_overview.final ||
               oldGame.price_overview.initial !== newGame.price_overview.initial ||
               oldGame.price_overview.discount_percent !== newGame.price_overview.discount_percent;
    }

    async syncNewGames() {
        try {
            console.log('Iniciando sincronización de nuevos juegos...');
            
            const steamGames = await SteamService.getGamesList();
            
            const existingGames = await Game.find({}, { appid: 1 });
            const existingIds = new Set(existingGames.map(g => g.appid));
            
            const newGames = steamGames.filter(game => !existingIds.has(game.appid));
            
            if (newGames.length === 0) {
                console.log('No se encontraron juegos nuevos para agregar.');
                return [];
            }
            
            console.log(`Encontrados ${newGames.length} juegos nuevos. Obteniendo detalles...`);
            
            const savedGames = [];
            for (const game of newGames) {
                try {
                    const gameDetails = await SteamService.getGameDetails(game.appid);
                    if (gameDetails) {
                        const newGame = new Game(gameDetails);
                        await newGame.save();
                        savedGames.push(newGame);
                        console.log(`Guardado nuevo juego: ${game.name} (${game.appid})`);
                    }
                    await new Promise(resolve => setTimeout(resolve, this.requestDelay));
                } catch (error) {
                    console.error(`Error guardando el juego ${game.appid}:`, error.message);
                }
            }
            
            console.log(`Sincronización completada. Guardados ${savedGames.length} juegos nuevos.`);
            return savedGames;
        } catch (error) {
            console.error('Error en la sincronización de nuevos juegos:', error);
            throw error;
        }
    }

    async updateAllGames() {
        try {
            console.log('Iniciando actualización de todos los juegos...');
            
            await this.syncNewGames();
            
            const games = await Game.find({});
            
            for (const game of games) {
                await this.updateGameDetails(game);
                await new Promise(resolve => setTimeout(resolve, this.requestDelay));
            }
            
            console.log('Actualización de juegos completada');
        } catch (error) {
            console.error('Error en la actualización masiva:', error.message);
        }
    }

    startUpdateCron() {
        this.updateAllGames();
        cron.schedule('0 */2 * * *', () => {
            console.log('Iniciando actualización programada...');
            this.updateAllGames();
        });
        
        console.log('Cronjob de actualización configurado para ejecutarse cada 2 horas');
    }
}

module.exports = new UpdateService();
