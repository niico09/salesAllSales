require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const gameRoutes = require('./routes/gameRoutes');
const updateService = require('./services/updateService');

const app = express();
const port = process.env.PORT || 3000;

connectDB();

app.use('/', gameRoutes);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Iniciamos el cronjob de actualización
    updateService.startUpdateCron();
});

module.exports = app;
