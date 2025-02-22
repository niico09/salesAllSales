require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.get('/steam-games', async (req, res) => {
    try {
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${process.env.STEAM_API_KEY}`);
        
        // Filter games: remove empty names and those containing 'test'
        const filteredGames = response.data.applist.apps.filter(game => 
            game.name && 
            game.name.trim() !== '' && 
            !game.name.toLowerCase().includes('test')
        );

        res.json({
            total: filteredGames.length,
            games: filteredGames
        });
    } catch (error) {
        console.error('Error fetching Steam games:', error.message);
        res.status(500).json({ error: 'Error fetching Steam games' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});