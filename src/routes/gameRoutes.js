const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { PAGINATION } = require('../config/constants');

/**
 * @swagger
 * /games:
 *   get:
 *     summary: Obtiene un listado de juegos con opciones de filtrado
 *     description: Retorna una lista paginada de juegos que coinciden con los criterios de filtrado
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filtrar por género
 *       - in: query
 *         name: publisher
 *         schema:
 *           type: string
 *         description: Filtrar por editor
 *       - in: query
 *         name: developer
 *         schema:
 *           type: string
 *         description: Filtrar por desarrollador
 *       - in: query
 *         name: initialLetter
 *         schema:
 *           type: string
 *         description: Filtrar por letra inicial del nombre
 *       - in: query
 *         name: discountPercent
 *         schema:
 *           type: number
 *         description: Filtrar por porcentaje de descuento exacto
 *       - in: query
 *         name: minDiscount
 *         schema:
 *           type: number
 *         description: Filtrar por descuento mínimo
 *       - in: query
 *         name: maxDiscount
 *         schema:
 *           type: number
 *         description: Filtrar por descuento máximo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 50
 *         description: Número de elementos por página (máximo 50)
 *       - in: query
 *         name: includeFilterOptions
 *         schema:
 *           type: boolean
 *         description: Incluir opciones de filtrado en la respuesta
 *     responses:
 *       200:
 *         description: Lista de juegos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Game'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *                 filterOptions:
 *                   type: object
 *                   description: Solo presente si includeFilterOptions=true
 *       500:
 *         description: Error del servidor
 */
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
            pageSize = Math.min(parseInt(req.query.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE)
        } = req.query;

        const filters = {
            genre,
            publisher,
            developer,
            initialLetter,
            discountPercent,
            minDiscount,
            maxDiscount
        };

        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

        const result = await searchService.searchGames(filters, page, pageSize);

        if (req.query.includeFilterOptions === 'true') {
            result.filterOptions = {
                genres: await searchService.getUniqueGenres(),
                publishers: await searchService.getUniquePublishers(),
                developers: await searchService.getUniqueDevelopers()
            };
        }

        res.json(result);
    } catch (error) {
        console.error('Error searching games:', error);
        res.status(500).json({
            message: 'Error searching games',
            error: error.message
        });
    }
});

module.exports = router;
