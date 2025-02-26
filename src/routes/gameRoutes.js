const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { PAGINATION } = require('../config/constants');

// Endpoint para buscar juegos con múltiples filtros
router.get('/games', async (req, res) => {
    try {
        const {
            genre,
            publisher,
            developer,
            initialLetter,
            discountPercent,
            minDiscount,
            maxDiscount,
            page = PAGINATION.DEFAULT_PAGE,
            pageSize = PAGINATION.DEFAULT_PAGE_SIZE
        } = req.query;

        // Construimos el objeto de filtros
        const filters = {
            genre,
            publisher,
            developer,
            initialLetter,
            discountPercent,
            minDiscount,
            maxDiscount
        };

        // Eliminamos los filtros undefined
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

        const result = await searchService.searchGames(filters, page, pageSize);

        // Si se solicitan los valores únicos para los filtros
        if (req.query.includeFilterOptions === 'true') {
            result.filterOptions = {
                genres: await searchService.getUniqueGenres(),
                publishers: await searchService.getUniquePublishers(),
                developers: await searchService.getUniqueDevelopers()
            };
        }

        res.json(result);
    } catch (error) {
        console.error('Error en la búsqueda de juegos:', error);
        res.status(500).json({
            message: 'Error al buscar juegos',
            error: error.message
        });
    }
});

module.exports = router;
