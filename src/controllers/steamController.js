/**
 * Controller for Steam games related endpoints
 * Follows SOLID principles and clean code practices
 */
const axios = require('axios');
const Game = require('../models/Game');
const logger = require('../utils/logger');
const { PAGINATION } = require('../config/constants');
const steamService = require('../services/steamService');

/**
 * Get Steam games with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSteamGames = async (req, res) => {
    try {
        // Apply default pagination with maximum limit of 50 items
        const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
        const pageSize = Math.min(parseInt(req.query.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
        
        logger.info(`Fetching Steam games - Page: ${page}, PageSize: ${pageSize}`);
        
        // Fetch games from Steam API
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        // Filter out games with empty names or test games
        const filteredGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );
        
        // Calculate pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedGames = filteredGames.slice(startIndex, endIndex);
        
        logger.info(`Found ${filteredGames.length} games, returning ${paginatedGames.length} games for page ${page}`);
        
        // Process games and save to database if they don't exist
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
        
        // Categorize games by type
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
        
        // Get MongoDB stats
        const totalGames = filteredGames.length;
        const mongoStats = {
            totalGames: await Game.countDocuments(),
            categorizedGames: {
                game: await Game.countDocuments({ type: 'game' }),
                dlc: await Game.countDocuments({ type: 'dlc' }),
                package: await Game.countDocuments({ type: 'package' })
            }
        };
        
        // Return response with pagination info
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

/**
 * Check differences between Steam API and database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkDifferences = async (req, res) => {
    try {
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        const steamGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );

        const dbGames = await Game.find({}, { appid: 1, name: 1, _id: 0 });
        
        const steamAppIds = new Set(steamGames.map(g => g.appid));
        const dbAppIds = new Set(dbGames.map(g => g.appid));

        const missingInDb = steamGames.filter(g => !dbAppIds.has(g.appid));
        const extraInDb = dbGames.filter(g => !steamAppIds.has(g.appid));

        res.json({
            statistics: {
                totalInSteam: steamGames.length,
                totalInDb: dbGames.length,
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

/**
 * Get stored games from database with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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

/**
 * Get game details including all available information from database
 * Time complexity: O(1) - Single database query and potential API call
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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
        
        // Try to find the game in the database
        let game = await Game.findOne({ appid });
        
        // Verificar si el juego necesita actualización
        // Se considera que necesita actualización si:
        // 1. No existe en la base de datos
        // 2. No tiene información de metacritic
        // 3. No tiene información de recommendations
        // 4. La última actualización fue hace más de 24 horas
        const needsUpdate = !game || 
                           !game.metacritic || 
                           !game.recommendations ||
                           (game.lastUpdated && (new Date() - new Date(game.lastUpdated)) > (24 * 60 * 60 * 1000)); // 24 hours
        
        if (needsUpdate) {
            logger.info(`Game not found or data is outdated. Updating from Steam API for appid: ${appid}`);
            
            // Get updated data from Steam API
            const gameDetails = await steamService.getGameDetails(appid, game ? game.name : 'Unknown');
            
            if (gameDetails) {
                if (!game) {
                    // Create new game if it doesn't exist
                    game = new Game(gameDetails);
                    await game.save();
                    logger.info(`Created new game entry for appid: ${appid}`);
                } else {
                    // Actualizar el juego existente utilizando programación inmutable
                    // Crear una copia del objeto para no modificar el original directamente
                    const updatedGame = { ...game.toObject() };
                    
                    // Actualizar todos los campos con los nuevos datos
                    Object.keys(gameDetails).forEach(key => {
                        if (gameDetails[key] !== undefined) {
                            // Asegurar que metacritic y recommendations siempre se guarden
                            if ((key === 'metacritic' || key === 'recommendations') && gameDetails[key]) {
                                updatedGame[key] = gameDetails[key];
                                game[key] = gameDetails[key];
                                logger.info(`Updated ${key} information for game ${appid}`);
                            } else {
                                updatedGame[key] = gameDetails[key];
                                game[key] = gameDetails[key];
                            }
                        }
                    });
                    
                    // Actualizar la fecha de última actualización
                    game.lastUpdated = new Date();
                    
                    await game.save();
                    logger.info(`Updated existing game entry for appid: ${appid}`);
                }
            } else {
                logger.warn(`No data available from Steam API for game with appid: ${appid}`);
                
                // Si el juego existe pero no se pudo obtener información actualizada,
                // asegurarse de que al menos tenga estructuras vacías para metacritic y recommendations
                if (game) {
                    if (!game.metacritic) {
                        game.metacritic = { score: null, url: null };
                    }
                    
                    if (!game.recommendations) {
                        game.recommendations = { total: 0 };
                    }
                    
                    await game.save();
                    logger.info(`Added empty metacritic and recommendations structures for game ${appid}`);
                } else {
                    return res.status(404).json({ 
                        error: 'Juego no encontrado',
                        message: 'No se pudo encontrar información para este juego en la API de Steam'
                    });
                }
            }
        }
        
        // Refresh game data from database to ensure we have the latest version
        game = await Game.findOne({ appid });
        
        if (!game) {
            return res.status(404).json({ 
                error: 'Juego no encontrado',
                message: 'No se pudo encontrar el juego solicitado en la base de datos'
            });
        }
        
        // Convert Mongoose document to plain JavaScript object
        const gameObject = game.toObject();
        
        // Remove MongoDB specific fields if needed
        delete gameObject.__v;
        
        // Return the complete game data
        res.json(gameObject);
    } catch (error) {
        logger.error(`Error fetching game details: ${error.message}`);
        res.status(500).json({ 
            error: 'Error al obtener detalles del juego',
            message: 'Se produjo un error al recuperar los detalles del juego solicitado'
        });
    }
};

module.exports = {
    getSteamGames,
    checkDifferences,
    getStoredGames,
    getGameDetails
};
