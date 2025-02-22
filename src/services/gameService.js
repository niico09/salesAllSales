const Game = require('../models/Game');
const steamService = require('./steamService');

class GameService {
    async findMissingGames(steamGames) {
        const dbGames = await Game.find({}, { appid: 1, _id: 0 });
        const dbAppIds = new Set(dbGames.map(g => g.appid));
        return steamGames.filter(game => !dbAppIds.has(game.appid));
    }

    async saveBasicInfo(games) {
        return Promise.all(
            games.map(game => 
                Game.findOneAndUpdate(
                    { appid: game.appid },
                    { 
                        appid: game.appid,
                        name: game.name,
                        lastUpdated: new Date()
                    },
                    { upsert: true, new: true }
                )
            )
        );
    }

    async processGamesPage(games, startIndex, endIndex, batchSize = 5) {
        const results = [];
        const gamesToProcess = games.slice(startIndex, endIndex);
        
        for (let i = 0; i < gamesToProcess.length; i += batchSize) {
            const batch = gamesToProcess.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (game) => {
                    const existingGame = await Game.findOne({ appid: game.appid });
                    
                    if (existingGame && existingGame.type) {
                        console.log(`Game ${game.appid} found in database with type: ${existingGame.type}`);
                        return existingGame;
                    }

                    console.log(`Fetching details for game ${game.appid} (${game.name})`);
                    const gameDetails = await steamService.getGameDetails(game.appid, game.name);
                    
                    if (gameDetails) {
                        const updatedGame = await Game.findOneAndUpdate(
                            { appid: game.appid },
                            gameDetails,
                            { upsert: true, new: true }
                        );
                        return updatedGame;
                    }

                    return existingGame || null;
                })
            );
            results.push(...batchResults);
        }
        
        return results;
    }

    async getStats() {
        return {
            totalGames: await Game.countDocuments(),
            gamesWithType: await Game.countDocuments({ type: { $exists: true } }),
            gamesWithoutType: await Game.countDocuments({ type: { $exists: false } }),
            byType: {
                games: await Game.countDocuments({ type: 'games' }),
                game: await Game.countDocuments({ type: 'game' }),
                dlc: await Game.countDocuments({ type: 'dlc' }),
                package: await Game.countDocuments({ type: 'package' })
            }
        };
    }

    categorizeGames(games) {
        return games
            .filter(game => game !== null && game.type)
            .reduce((acc, game) => {
                if (['game', 'games', 'dlc', 'package'].includes(game.type)) {
                    if (!acc[game.type]) {
                        acc[game.type] = [];
                    }
                    acc[game.type].push(game);
                }
                return acc;
            }, {});
    }

    async findStoredGames(options) {
        const { page = 1, pageSize = 50, type, withType } = options;
        
        let query = {};
        if (type) {
            query.type = type;
        }
        if (withType !== undefined) {
            query.type = withType ? { $exists: true } : { $exists: false };
        }

        const games = await Game.find(query)
            .skip((page - 1) * pageSize)
            .limit(pageSize);

        const total = await Game.countDocuments(query);

        return {
            pagination: {
                currentPage: page,
                pageSize,
                totalGames: total,
                totalPages: Math.ceil(total / pageSize)
            },
            games
        };
    }
}

module.exports = new GameService();
