const cron = require('node-cron');
const Game = require('../models/Game');
const BlacklistGame = require('../models/BlacklistGame');
const SteamService = require('./steamService');
const logger = require('../utils/logger');

class UpdateService {
  constructor() {
    this.requestDelay = 1000;
    this.concurrencyLimit = 5;
    this.logger = logger;
  }

  async updateGameDetails(game) {
    try {
      const updatedGameData = await SteamService.getGameDetails(game.appid, game.name);
      
      if (updatedGameData && updatedGameData.blacklist) {
        this.logger.warn(`Game ${game.name} (${game.appid}) returned success: false. Adding to blacklist.`);
        await this.addToBlacklist(game.appid, game.name);
        return null;
      }
      
      if (!updatedGameData) {
        this.logger.warn(`No data available for game ${game.name} (${game.appid})`);
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

      this.logger.info(`Game updated successfully: ${game.name} (${game.appid})`);
      return game;
    } catch (error) {
      this.logger.error(`Error updating game ${game.appid}: ${error.message}`);
      return null;
    }
  }

  async addToBlacklist(appid, name) {
    try {
      const existingBlacklisted = await BlacklistGame.findOne({ appid });

      if (existingBlacklisted) {
        await BlacklistGame.updateOne(
          { appid },
          {
            $inc: { attemptCount: 1 },
            $set: { lastAttempt: new Date() }
          }
        );
        this.logger.info(
          `Updated blacklist entry for game ${name} (${appid}), attempt count: ${existingBlacklisted.attemptCount + 1}`
        );
      } else {
        const blacklistGame = new BlacklistGame({
          appid,
          name
        });
        await blacklistGame.save();
        this.logger.info(`Added game ${name} (${appid}) to blacklist`);
      }
    } catch (error) {
      this.logger.error(`Error adding game to blacklist ${appid}: ${error.message}`);
    }
  }

  hasPriceChanged(oldGame, newGame) {
    this.logger = logger;
    if (!oldGame.price && !newGame.price) return false;
    if (!oldGame.price || !newGame.price) return true;

    return oldGame.price.final !== newGame.price.final
      || oldGame.price.initial !== newGame.price.initial
      || oldGame.price.discount_percent !== newGame.price.discount_percent;
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
          const currentIndex = index;
          index += 1;
          const item = items[currentIndex];

          inProgress.add(currentIndex);

          asyncFn(item).then((result) => {
            results[currentIndex] = result;
            inProgress.delete(currentIndex);
            processNext();
          }).catch((error) => {
            this.logger.error(`Error processing item at index ${currentIndex}: ${error.message}`);
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
      this.logger.info('Starting synchronization of new games...');

      const steamGames = await SteamService.getGamesList();

      const existingIds = await Game.distinct('appid');
      const blacklistedIds = await BlacklistGame.distinct('appid');

      const existingIdsSet = new Set([...existingIds, ...blacklistedIds]);

      const newGames = steamGames.filter((game) => !existingIdsSet.has(game.appid));

      if (newGames.length === 0) {
        this.logger.info('No new games found to add.');
        return [];
      }

      this.logger.info(`Found ${newGames.length} new games. Getting details...`);

      const processGameDetails = async (game) => {
        try {
          const gameDetails = await SteamService.getGameDetails(game.appid, game.name);

          if (gameDetails && gameDetails.blacklist) {
            this.logger.warn(`Game ${game.name} (${game.appid}) returned success: false. Adding to blacklist.`);
            await this.addToBlacklist(game.appid, game.name);
            return null;
          }

          if (!gameDetails) {
            this.logger.warn(`No data available for game ${game.name} (${game.appid}) but not adding to blacklist`);
            return null;
          }

          const newGame = new Game(gameDetails);
          await newGame.save({
            writeConcern: { w: 0 },
            bypassDocumentValidation: true,
            ordered: false
          });

          this.logger.info(`Saved new game: ${game.name} (${game.appid})`);
          return newGame;
        } catch (error) {
          this.logger.error(`Error saving game ${game.appid}: ${error.message}`);
          return null;
        }
      };

      const savedGames = await this.processBatchWithConcurrency(newGames, processGameDetails);
      const validSavedGames = savedGames.filter((game) => game !== null);

      this.logger.info(`Synchronization completed. Saved ${validSavedGames.length} new games.`);
      return validSavedGames;
    } catch (error) {
      this.logger.error(`Error in new games synchronization: ${error.message}`);
      throw error;
    }
  }

  async updateAllGames() {
    try {
      this.logger.info('Starting update of all games...');

      await this.syncNewGames();

      const BATCH_SIZE = 100;
      let skip = 0;

      const processNextBatch = async () => {
        const games = await Game.find({})
          .sort({ lastUpdated: 1 })
          .skip(skip)
          .limit(BATCH_SIZE)
          .lean();

        if (games.length === 0) {
          return false;
        }

        this.logger.info(`Processing batch of ${games.length} games (skip: ${skip})`);

        const updatePromises = games.map((game) => this.updateGameDetails(game));
        await Promise.all(updatePromises);

        skip += BATCH_SIZE;
        return true;
      };

      const processAllBatchesRecursive = async () => {
        const shouldContinue = await processNextBatch();
        if (shouldContinue) {
          return processAllBatchesRecursive();
        }
        return true;
      };

      processAllBatchesRecursive()
        .then(() => {
          this.logger.info('Game update completed successfully');
        })
        .catch((error) => {
          this.logger.error(`Error in batch processing: ${error.message}`);
        });
    } catch (error) {
      this.logger.error(`Error in mass update: ${error.message}`);
    }
  }

  startUpdateCronJob() {
    this.logger.info('Configuring update cronjob...');

    const cronSchedule = process.env.UPDATE_CRON_SCHEDULE || '0 */2 * * *';
    this.logger.info('Executing initial update at startup...');
    this.updateAllGames();

    cron.schedule(cronSchedule, () => {
      this.logger.info('Starting scheduled update...');
      this.updateAllGames();
    });

    this.logger.info(`Update cronjob configured to run with schedule: ${cronSchedule}`);
  }

  async createIndexesInBackground() {
    try {
      this.logger.info('Creating indexes in background...');

      await Game.createIndexes([
        { key: { appid: 1 }, unique: true, background: true },
        { key: { name: 1 }, background: true },
        { key: { type: 1 }, background: true },
        { key: { 'price.final': 1 }, background: true },
        { key: { 'price.discount_percent': 1 }, background: true },
        { key: { lastUpdated: 1 }, background: true },
        { key: { genres: 1 }, background: true },
        { key: { developers: 1 }, background: true },
        { key: { publishers: 1 }, background: true }
      ]);

      await BlacklistGame.createIndexes([
        { key: { appid: 1 }, unique: true, background: true },
        { key: { attemptCount: 1 }, background: true },
        { key: { lastAttempt: 1 }, background: true }
      ]);

      this.logger.info('Indexes created successfully');
    } catch (error) {
      this.logger.error(`Error creating indexes: ${error.message}`);
    }
  }
}

module.exports = new UpdateService();
