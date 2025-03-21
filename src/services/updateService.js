const cron = require('node-cron');
const Game = require('../models/Game');
const SteamService = require('./steamService');
const logger = require('../utils/logger');

class UpdateService {
    constructor() {
        this.requestDelay = 1000;
        this.concurrencyLimit = 5;
    }

    async updateGameDetails(game) {
        try {
            const updatedGameData = await SteamService.getGameDetails(game.appid, game.name);
            if (!updatedGameData) {
                logger.warn(`No data available for game ${game.name} (${game.appid})`);
                return null;
            }

            if (this.hasPriceChanged(game, updatedGameData)) {
                await Game.updateOne(
                    { _id: game._id },
                    { 
                        $push: { priceHistory: game.price },
                        $set: { 
                            ...updatedGameData,
                            lastUpdated: new Date()
                        }
                    },
                    { 
                        writeConcern: { w: 1 },
                        bypassDocumentValidation: true
                    }
                );
            } else {
                await Game.updateOne(
                    { _id: game._id },
                    { 
                        $set: { 
                            ...updatedGameData,
                            lastUpdated: new Date()
                        }
                    },
                    { 
                        writeConcern: { w: 1 },
                        bypassDocumentValidation: true
                    }
                );
            }
            
            logger.info(`Game updated successfully: ${game.name} (${game.appid})`);
            return game;
        } catch (error) {
            logger.error(`Error updating game ${game.appid}: ${error.message}`);
            return null;
        }
    }

    hasPriceChanged(oldGame, newGame) {
        if (!oldGame.price && !newGame.price) return false;
        if (!oldGame.price || !newGame.price) return true;
        
        return oldGame.price.final !== newGame.price.final ||
               oldGame.price.initial !== newGame.price.initial ||
               oldGame.price.discount_percent !== newGame.price.discount_percent;
    }

    async processBatchWithConcurrency(items, asyncFn) {
        const results = [];
        const inProgress = new Set();
        let index = 0;

        return new Promise((resolve) => {
            const processNext = async () => {
                if (index >= items.length && inProgress.size === 0) {
                    return resolve(results);
                }

                while (index < items.length && inProgress.size < this.concurrencyLimit) {
                    const currentIndex = index++;
                    const item = items[currentIndex];
                    
                    inProgress.add(currentIndex);
                    
                    asyncFn(item).then(result => {
                        results[currentIndex] = result;
                        inProgress.delete(currentIndex);
                        processNext();
                    }).catch(error => {
                        logger.error(`Error processing item at index ${currentIndex}: ${error.message}`);
                        results[currentIndex] = null;
                        inProgress.delete(currentIndex);
                        processNext();
                    });
                }
            };

            processNext();
        });
    }

    async syncNewGames() {
        try {
            logger.info('Starting synchronization of new games...');
            
            const steamGames = await SteamService.getGamesList();
            
            const existingIds = await Game.distinct('appid');
            const existingIdsSet = new Set(existingIds);
            
            const newGames = steamGames.filter(game => !existingIdsSet.has(game.appid));
            
            if (newGames.length === 0) {
                logger.info('No new games found to add.');
                return [];
            }
            
            logger.info(`Found ${newGames.length} new games. Getting details...`);
            
            const processGameDetails = async (game) => {
                try {
                    const gameDetails = await SteamService.getGameDetails(game.appid, game.name);
                    if (!gameDetails) return null;
                    
                    const newGame = new Game(gameDetails);
                    await newGame.save({
                        writeConcern: { w: 0 },
                        bypassDocumentValidation: true,
                        ordered: false
                    });
                    
                    logger.info(`Saved new game: ${game.name} (${game.appid})`);
                    return newGame;
                } catch (error) {
                    logger.error(`Error saving game ${game.appid}: ${error.message}`);
                    return null;
                }
            };
            
            const savedGames = await this.processBatchWithConcurrency(newGames, processGameDetails);
            const validSavedGames = savedGames.filter(game => game !== null);
            
            logger.info(`Synchronization completed. Saved ${validSavedGames.length} new games.`);
            return validSavedGames;
        } catch (error) {
            logger.error(`Error in new games synchronization: ${error.message}`);
            throw error;
        }
    }

    async updateAllGames() {
        try {
            logger.info('Starting update of all games...');
            
            await this.syncNewGames();
            
            const BATCH_SIZE = 100;
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const games = await Game.find({})
                    .sort({ lastUpdated: 1 })
                    .skip(skip)
                    .limit(BATCH_SIZE)
                    .lean();
                
                if (games.length === 0) {
                    hasMore = false;
                    break;
                }
                
                logger.info(`Processing batch of ${games.length} games (skip: ${skip})`);
                
                await this.processBatchWithConcurrency(games, (game) => this.updateGameDetails(game));
                
                skip += BATCH_SIZE;
            }
            
            logger.info('Game update completed successfully');
        } catch (error) {
            logger.error(`Error in mass update: ${error.message}`);
        }
    }

    startUpdateCron() {
        this.updateAllGames();
        
        const cronSchedule = process.env.UPDATE_CRON_SCHEDULE || '0 */2 * * *';
        cron.schedule(cronSchedule, () => {
            logger.info('Starting scheduled update...');
            this.updateAllGames();
        });
        
        logger.info(`Update cronjob configured to run with schedule: ${cronSchedule}`);
    }

    async createIndexesInBackground() {
        try {
            logger.info('Creating indexes in background...');
            await Game.createIndexes({ background: true });
            logger.info('Indexes created successfully');
        } catch (error) {
            logger.error(`Error creating indexes: ${error.message}`);
        }
    }
}

module.exports = new UpdateService();
