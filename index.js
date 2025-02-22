require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/api/games', async (req, res) => {
    try {
        const steamApiKey = process.env.STEAM_API_KEY;
        const response = await axios.get(`https://api.steampowered.com/ISteamApps/GetAppList/v2/?key=${steamApiKey}`);
        
        // Filter out games with empty names and test in the name
        const filteredGames = {
            applist: {
                apps: response.data.applist.apps.filter(app => 
                    app.name && 
                    app.name.trim() !== '' && 
                    !app.name.toLowerCase().includes('test')
                )
            }
        };
        
        // Return the filtered games list
        res.json(filteredGames);
    } catch (error) {
        console.error('Error fetching games:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch games',
            message: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});