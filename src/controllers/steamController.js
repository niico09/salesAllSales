const axios = require('axios');
const Game = require('../models/Game');
const GameBlacklist = require('../models/GameBlacklist');
const logger = require('../utils/logger');
const { PAGINATION } = require('../config/constants');
const steamService = require('../services/steamService');

const getSteamGames = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
        const pageSize = Math.min(parseInt(req.query.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
        
        logger.info(`Fetching Steam games - Page: ${page}, PageSize: ${pageSize}`);
        
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        const filteredGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );
        
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedGames = filteredGames.slice(startIndex, endIndex);
        
        logger.info(`Found ${filteredGames.length} games, returning ${paginatedGames.length} games for page ${page}`);
        
        for (const game of paginatedGames) {
            try {
                const existingGame = await Game.findOne({ appid: game.appid });
                
                if (!existingGame) {
                    logger.info(`Saving new game to database: ${game.name} (${game.appid})`);
                    await new Game({
                        appid: game.appid,
                        name: game.name
                    }).save();
                }
            } catch (error) {
                if (error.code === 11000) {
                    logger.warn(`Intento de guardar juego duplicado: ${game.name} (${game.appid})`);
                } else {
                    logger.error(`Error guardando el juego ${game.appid}: ${error.message}`);
                }
            }
        }
        
        const categorizedGames = {
            games: paginatedGames.filter(game => 
                game.name.toLowerCase().includes('game') || 
                !game.name.toLowerCase().includes('dlc') && 
                !game.name.toLowerCase().includes('soundtrack') && 
                !game.name.toLowerCase().includes('pack')
            ),
            dlc: paginatedGames.filter(game => 
                game.name.toLowerCase().includes('dlc') || 
                game.name.toLowerCase().includes('pack') || 
                game.name.toLowerCase().includes('addon')
            ),
            package: paginatedGames.filter(game => 
                game.name.toLowerCase().includes('bundle') || 
                game.name.toLowerCase().includes('collection') || 
                game.name.toLowerCase().includes('complete') || 
                game.name.toLowerCase().includes('edition')
            )
        };
        
        const totalGames = filteredGames.length;
        const mongoStats = {
            totalGames: await Game.countDocuments(),
            categorizedGames: {
                game: await Game.countDocuments({ type: 'game' }),
                dlc: await Game.countDocuments({ type: 'dlc' }),
                package: await Game.countDocuments({ type: 'package' })
            },
            blacklistedGames: await GameBlacklist.countDocuments()
        };
        
        res.json({
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalGames: totalGames,
                totalPages: Math.ceil(totalGames / pageSize)
            },
            total: Object.values(categorizedGames).flat().length,
            categorizedGames,
            mongoStats
        });
    } catch (error) {
        logger.error(`Error fetching Steam games: ${error.message}`);
        res.status(500).json({ error: 'Error fetching Steam games' });
    }
};

const checkDifferences = async (req, res) => {
    try {
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        const steamGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );

        const dbGames = await Game.find({}, { appid: 1, name: 1, _id: 0 });
        const blacklistedGames = await GameBlacklist.find({}, { appid: 1, _id: 0 });
        
        const steamAppIds = new Set(steamGames.map(g => g.appid));
        const dbAppIds = new Set(dbGames.map(g => g.appid));
        const blacklistedAppIds = new Set(blacklistedGames.map(g => g.appid));

        const missingInDb = steamGames.filter(g => !dbAppIds.has(g.appid) && !blacklistedAppIds.has(g.appid));
        const extraInDb = dbGames.filter(g => !steamAppIds.has(g.appid));

        res.json({
            statistics: {
                totalInSteam: steamGames.length,
                totalInDb: dbGames.length,
                totalBlacklisted: blacklistedGames.length,
                missingInDb: missingInDb.length,
                extraInDb: extraInDb.length
            },
            differences: {
                missingInDb: missingInDb,
                extraInDb: extraInDb
            }
        });
    } catch (error) {
        logger.error(`Error checking differences: ${error.message}`);
        res.status(500).json({ error: 'Error checking differences' });
    }
};

const getStoredGames = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
        const pageSize = Math.min(parseInt(req.query.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
        const type = req.query.type;
        const withType = req.query.withType === 'true';

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

        res.json({
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalGames: total,
                totalPages: Math.ceil(total / pageSize)
            },
            games
        });
    } catch (error) {
        logger.error(`Error fetching stored games: ${error.message}`);
        res.status(500).json({ error: 'Error fetching stored games' });
    }
};

const getGameDetails = async (req, res) => {
    try {
        const { appid } = req.params;
        
        if (!appid) {
            return res.status(400).json({ message: 'AppID is required' });
        }

        const existingGame = await Game.findOne({ appid });
        const gameDetails = await steamService.getGameDetails(appid, existingGame?.name || '');
        
        if (!gameDetails) {
            return res.status(404).json({ message: 'Game not found or no data available' });
        }

        try {
            if (existingGame) {
                const updatedGame = await _updateExistingGame(existingGame, gameDetails);
                return res.json(updatedGame);
            } else {
                const newGame = new Game(gameDetails);
                await newGame.save();
                return res.json(newGame);
            }
        } catch (saveError) {
            if (saveError.name === 'ValidationError') {
                logger.error(`Validation error for game ${appid}: ${saveError.message}`);
                
                if (saveError.message.includes('required_age')) {
                    await GameBlacklist.findOneAndUpdate(
                        { appid: parseInt(appid) },
                        { 
                            appid: parseInt(appid), 
                            reason: `Validation error: ${saveError.message}`,
                            createdAt: new Date()
                        },
                        { upsert: true, new: true }
                    );
                    logger.info(`Added game ${appid} to blacklist due to validation error`);
                }
                
                return res.status(400).json({ 
                    message: 'Invalid game data', 
                    error: saveError.message 
                });
            }
            
            if (saveError.code === 11000) {
                logger.warn(`Duplicate key error for game ${appid}, attempting update`);
                try {
                    const updatedGame = await Game.findOneAndUpdate(
                        { appid: gameDetails.appid },
                        { $set: gameDetails },
                        { new: true }
                    );
                    return res.json(updatedGame);
                } catch (updateError) {
                    logger.error(`Error updating game ${appid}: ${updateError.message}`);
                    return res.status(500).json({ message: 'Error updating game' });
                }
            }
            
            logger.error(`Error saving game ${appid}: ${saveError.message}`);
            return res.status(500).json({ message: 'Error saving game' });
        }
    } catch (error) {
        logger.error(`Error in getGameDetails: ${error.message}`);
        return res.status(500).json({ message: 'Server error' });
    }
};

const _updateExistingGame = async (existingGame, newGameData) => {
    Object.keys(newGameData).forEach(key => {
        if (newGameData[key] !== undefined) {
            if (key === 'metacritic' || key === 'recommendations') {
                existingGame[key] = newGameData[key];
            } else if (key === 'prices' && newGameData.prices && newGameData.prices.length > 0) {
                if (!existingGame.prices || existingGame.prices.length === 0) {
                    existingGame.prices = newGameData.prices;
                } else {
                    newGameData.prices.forEach(newPrice => {
                        const existingPriceIndex = existingGame.prices.findIndex(
                            p => p.platform === newPrice.platform
                        );
                        
                        if (existingPriceIndex >= 0) {
                            existingGame.prices[existingPriceIndex] = newPrice;
                        } else {
                            existingGame.prices.push(newPrice);
                        }
                    });
                }
            } else {
                existingGame[key] = newGameData[key];
            }
        }
    });
    
    if (existingGame.price) existingGame.price = undefined;
    if (existingGame.price_overview) existingGame.price_overview = undefined;
    
    existingGame.lastUpdated = new Date();
    
    try {
        await existingGame.save();
        logger.info(`Updated existing game entry for appid: ${existingGame.appid}`);
        return existingGame;
    } catch (error) {
        if (error.code === 11000) {
            logger.warn(`Duplicate key error when updating game ${existingGame.appid}. Attempting updateOne instead.`);
            const updateData = existingGame.toObject();
            delete updateData._id;
            await Game.updateOne({ appid: existingGame.appid }, updateData);
            return await Game.findOne({ appid: existingGame.appid });
        }
        throw error;
    }
};

const getBlacklistedGames = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
        const pageSize = Math.min(parseInt(req.query.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
        
        const blacklistedGames = await GameBlacklist.find()
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .sort({ createdAt: -1 });
            
        const total = await GameBlacklist.countDocuments();
        
        res.json({
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalGames: total,
                totalPages: Math.ceil(total / pageSize)
            },
            blacklistedGames
        });
    } catch (error) {
        logger.error(`Error fetching blacklisted games: ${error.message}`);
        res.status(500).json({ error: 'Error al obtener juegos en lista negra' });
    }
};

const removeFromBlacklist = async (req, res) => {
    try {
        const appid = parseInt(req.params.appid);
        
        if (!appid || isNaN(appid)) {
            return res.status(400).json({ 
                error: 'ID de aplicación inválido',
                message: 'El ID de aplicación debe ser un número entero válido'
            });
        }
        
        const result = await GameBlacklist.deleteOne({ appid });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                error: 'Juego no encontrado en la lista negra',
                message: 'No se pudo encontrar el juego especificado en la lista negra'
            });
        }
        
        logger.info(`Removed game with appid ${appid} from blacklist`);
        
        res.json({ 
            success: true, 
            message: `Juego con appid ${appid} eliminado de la lista negra` 
        });
    } catch (error) {
        logger.error(`Error removing game from blacklist: ${error.message}`);
        res.status(500).json({ 
            error: 'Error al eliminar juego de la lista negra',
            message: 'Se produjo un error al intentar eliminar el juego de la lista negra'
        });
    }
};

module.exports = {
    getSteamGames,
    checkDifferences,
    getStoredGames,
    getGameDetails,
    getBlacklistedGames,
    removeFromBlacklist,
    _updateExistingGame
};
