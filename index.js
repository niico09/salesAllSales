require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Game = require('./models/Game');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/salesAllSales';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

mongoose.connect(mongoUri).then(() => {
    console.log('Connected to MongoDB at:', mongoUri);
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

async function findMissingGames(steamGames) {
    const dbGames = await Game.find({}, { appid: 1, _id: 0 });
    const dbAppIds = new Set(dbGames.map(g => g.appid));
    
    const missingGames = steamGames.filter(game => !dbAppIds.has(game.appid));
    
    return missingGames;
}

app.get('/steam-games', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        const filteredGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );


        const missingGames = await findMissingGames(filteredGames);
        
        if (missingGames.length > 0) {
            console.log(`Encontrados ${missingGames.length} juegos nuevos. Guardando información básica...`);
            await Promise.all(
                missingGames.map(async (game) => {
                    await Game.findOneAndUpdate(
                        { appid: game.appid },
                        { 
                            appid: game.appid,
                            name: game.name,
                            lastUpdated: new Date()
                        },
                        { upsert: true, new: true }
                    );
                })
            );
            console.log('Juegos nuevos guardados.');
        } else {
            console.log('No se encontraron juegos nuevos para guardar.');
        }

        const totalGames = filteredGames.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        const batchSize = 5;
        const results = [];
        
        const gamesToProcess = filteredGames.slice(startIndex, endIndex);
        
        for (let i = 0; i < gamesToProcess.length; i += batchSize) {
            const batch = gamesToProcess.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (game) => {
                    try {
                        const existingGame = await Game.findOne({ appid: game.appid });
                        
                        if (existingGame && existingGame.type) {
                            console.log(`Game ${game.appid} found in database with type: ${existingGame.type}`);
                            return existingGame;
                        }

                        console.log(`Fetching details for game ${game.appid} (${game.name})`);
                        await delay(1000);
                        const detailsResponse = await axios.get(
                            `https://store.steampowered.com/api/appdetails?appids=${game.appid}`
                        );
                        
                        if (detailsResponse.data[game.appid] && detailsResponse.data[game.appid].success) {
                            const gameData = detailsResponse.data[game.appid].data;
                            
                            if (['game', 'games', 'dlc', 'package'].includes(gameData.type)) {
                                console.log(`Successfully processed game ${game.appid} (${game.name}) - Type: ${gameData.type}`);
                                
                                const gameToSave = {
                                    appid: game.appid,
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

                                const updatedGame = await Game.findOneAndUpdate(
                                    { appid: game.appid },
                                    gameToSave,
                                    { upsert: true, new: true }
                                );

                                return updatedGame;
                            }
                        }
                        console.log(`Skipping game ${game.appid} (${game.name}) - Invalid type or no data`);
                        return existingGame || null;
                    } catch (error) {
                        console.error(`Error fetching details for game ${game.appid}:`, error.message);
                        return null;
                    }
                })
            );
            results.push(...batchResults);
        }

        const categorizedGames = results
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

        const mongoStats = {
            totalGames: await Game.countDocuments(),
            gamesWithType: await Game.countDocuments({ type: { $exists: true } }),
            gamesWithoutType: await Game.countDocuments({ type: { $exists: false } }),
            newGamesFound: missingGames.length,
            byType: {
                games: await Game.countDocuments({ type: 'games' }),
                game: await Game.countDocuments({ type: 'game' }),
                dlc: await Game.countDocuments({ type: 'dlc' }),
                package: await Game.countDocuments({ type: 'package' })
            }
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
        console.error('Error fetching Steam games:', error.message);
        res.status(500).json({ error: 'Error fetching Steam games' });
    }
});

app.get('/check-differences', async (req, res) => {
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
        console.error('Error checking differences:', error.message);
        res.status(500).json({ error: 'Error checking differences' });
    }
});

app.get('/stored-games', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
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
        console.error('Error fetching stored games:', error.message);
        res.status(500).json({ error: 'Error fetching stored games' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});