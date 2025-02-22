const express = require('express');
const router = express.Router();
const gameService = require('../services/gameService');
const steamService = require('../services/steamService');

router.get('/steam-games', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        
        const steamGames = await steamService.getGamesList();
        const missingGames = await gameService.findMissingGames(steamGames);
        
        if (missingGames.length > 0) {
            console.log(`Encontrados ${missingGames.length} juegos nuevos. Guardando información básica...`);
            await gameService.saveBasicInfo(missingGames);
            console.log('Juegos nuevos guardados.');
        } else {
            console.log('No se encontraron juegos nuevos para guardar.');
        }

        const totalGames = steamGames.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        const results = await gameService.processGamesPage(steamGames, startIndex, endIndex);
        const categorizedGames = gameService.categorizeGames(results);
        const mongoStats = await gameService.getStats();
        mongoStats.newGamesFound = missingGames.length;

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

router.get('/check-differences', async (req, res) => {
    try {
        const steamGames = await steamService.getGamesList();
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

router.get('/stored-games', async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 50,
            type: req.query.type,
            withType: req.query.withType === 'true'
        };

        const result = await gameService.findStoredGames(options);
        res.json(result);
    } catch (error) {
        console.error('Error fetching stored games:', error.message);
        res.status(500).json({ error: 'Error fetching stored games' });
    }
});

module.exports = router;
