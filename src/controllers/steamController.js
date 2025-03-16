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
            const existingGame = await Game.findOne({ appid: game.appid });
            
            if (!existingGame) {
                logger.info(`Saving new game to database: ${game.name} (${game.appid})`);
                await new Game({
                    appid: game.appid,
                    name: game.name
                }).save();
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
        const appid = parseInt(req.params.appid);
        
        if (!appid || isNaN(appid)) {
            logger.warn(`Intento de acceso con ID de aplicación inválido: ${req.params.appid}`);
            return res.status(400).json({ 
                error: 'ID de aplicación inválido',
                message: 'El ID de aplicación debe ser un número entero válido'
            });
        }
        
        logger.info(`Fetching details for game with appid: ${appid}`);
        
        const blacklistedGame = await GameBlacklist.findOne({ appid });
        if (blacklistedGame) {
            logger.info(`Game with appid ${appid} is blacklisted. Reason: ${blacklistedGame.reason}`);
            return res.status(404).json({ 
                error: 'Juego en lista negra',
                message: 'Este juego está en la lista negra porque no tiene datos disponibles',
                reason: blacklistedGame.reason,
                blacklistedAt: blacklistedGame.createdAt
            });
        }
        
        let game = await Game.findOne({ appid });
        
        if (game && game.price && !game.prices) {
            logger.info(`Migrando datos de price a prices para el juego ${appid}`);
            
            game.prices = [{
                platform: 'steam',
                currency: game.price.currency,
                initial: game.price.initial,
                final: game.price.final,
                discount_percent: game.price.discount_percent,
                initial_formatted: game.price.initial_formatted,
                final_formatted: game.price.final_formatted,
                lastChecked: game.price.lastChecked || new Date()
            }];
            
            game.price = undefined;
            
            if (game.price_overview) {
                game.price_overview = undefined;
            }
            
            await game.save();
            logger.info(`Migración a nuevo formato de precios completada para el juego ${appid}`);
        }
        
        const needsUpdate = !game || 
                           !game.metacritic || 
                           !game.recommendations ||
                           !game.prices ||
                           (game.lastUpdated && (new Date() - new Date(game.lastUpdated)) > (24 * 60 * 60 * 1000));
        
        if (needsUpdate) {
            logger.info(`Game not found or data is outdated. Updating from Steam API for appid: ${appid}`);
            
            const gameDetails = await steamService.getGameDetails(appid, game ? game.name : 'Unknown');
            
            if (gameDetails) {
                if (!game) {
                    game = new Game(gameDetails);
                    await game.save();
                    logger.info(`Created new game entry for appid: ${appid}`);
                } else {
                    Object.keys(gameDetails).forEach(key => {
                        if (gameDetails[key] !== undefined) {
                            if (key === 'metacritic' || key === 'recommendations') {
                                game[key] = gameDetails[key];
                                logger.info(`Updated ${key} information for game ${appid}`);
                            } else if (key === 'prices' && gameDetails.prices && gameDetails.prices.length > 0) {
                                if (!game.prices || game.prices.length === 0) {
                                    game.prices = gameDetails.prices;
                                } else {
                                    gameDetails.prices.forEach(newPrice => {
                                        const existingPriceIndex = game.prices.findIndex(
                                            p => p.platform === newPrice.platform
                                        );
                                        
                                        if (existingPriceIndex >= 0) {
                                            game.prices[existingPriceIndex] = newPrice;
                                        } else {
                                            game.prices.push(newPrice);
                                        }
                                    });
                                }
                                logger.info(`Updated prices information for game ${appid}`);
                            } else {
                                game[key] = gameDetails[key];
                            }
                        }
                    });
                    
                    if (game.price) game.price = undefined;
                    if (game.price_overview) game.price_overview = undefined;
                    
                    game.lastUpdated = new Date();
                    await game.save();
                    logger.info(`Updated existing game entry for appid: ${appid}`);
                }
            } else {
                logger.warn(`No data available from Steam API for game with appid: ${appid}`);
                
                const blacklistedGame = await GameBlacklist.findOne({ appid });
                if (blacklistedGame) {
                    return res.status(404).json({ 
                        error: 'Juego en lista negra',
                        message: 'Este juego está en la lista negra porque no tiene datos disponibles',
                        reason: blacklistedGame.reason,
                        blacklistedAt: blacklistedGame.createdAt
                    });
                }
                
                if (game) {
                    if (!game.metacritic) {
                        game.metacritic = { score: null, url: null };
                    }
                    
                    if (!game.recommendations) {
                        game.recommendations = { total: 0 };
                    }
                    
                    if (!game.prices || game.prices.length === 0) {
                        game.prices = [];
                    }
                    
                    await game.save();
                    logger.info(`Added empty structures for game ${appid}`);
                } else {
                    return res.status(404).json({ 
                        error: 'Juego no encontrado',
                        message: 'No se pudo encontrar información para este juego en la API de Steam'
                    });
                }
            }
        }
        
        game = await Game.findOne({ appid });
        
        if (!game) {
            return res.status(404).json({ 
                error: 'Juego no encontrado',
                message: 'No se pudo encontrar el juego solicitado en la base de datos'
            });
        }
        
        const gameObject = game.toObject();
        
        delete gameObject.__v;
        if (gameObject.price) delete gameObject.price;
        if (gameObject.price_overview) delete gameObject.price_overview;
        
        res.json(gameObject);
    } catch (error) {
        logger.error(`Error fetching game details: ${error.message}`);
        res.status(500).json({ 
            error: 'Error al obtener detalles del juego',
            message: 'Se produjo un error al recuperar los detalles del juego solicitado'
        });
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
    removeFromBlacklist
};
