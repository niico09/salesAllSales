const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { PAGINATION } = require('../config/constants');

/**
 * @swagger
 * /api/games:
 *   get:
 *     summary: Get a list of games with filtering options
 *     description: Returns a paginated list of games that match the filtering criteria
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: publisher
 *         schema:
 *           type: string
 *         description: Filter by publisher
 *       - in: query
 *         name: developer
 *         schema:
 *           type: string
 *         description: Filter by developer
 *       - in: query
 *         name: initialLetter
 *         schema:
 *           type: string
 *         description: Filter by initial letter of the name
 *       - in: query
 *         name: discountPercent
 *         schema:
 *           type: number
 *         description: Filter by exact discount percentage
 *       - in: query
 *         name: minDiscount
 *         schema:
 *           type: number
 *         description: Filter by minimum discount
 *       - in: query
 *         name: maxDiscount
 *         schema:
 *           type: number
 *         description: Filter by maximum discount
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 50
 *         description: Number of items per page (maximum 50)
 *       - in: query
 *         name: includeFilterOptions
 *         schema:
 *           type: boolean
 *         description: Include filter options in the response
 *     responses:
 *       200:
 *         description: List of games
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
 *                   description: Only present if includeFilterOptions=true
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
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
      pageSize = Math.min(
        parseInt(req.query.pageSize, 10) || PAGINATION.DEFAULT_PAGE_SIZE,
        PAGINATION.MAX_PAGE_SIZE
      )
    } = req.query;

    const filters = {
      genre,
      publisher,
      developer,
      initialLetter,
      discountPercent: discountPercent ? parseInt(discountPercent, 10) : undefined,
      minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
      maxDiscount: maxDiscount ? parseInt(maxDiscount, 10) : undefined,
      isFree: req.query.isFree === 'true'
    };

    const includeFilterOptions = req.query.includeFilterOptions === 'true';
    const result = await searchService.searchGames(filters, page, pageSize, includeFilterOptions);

    res.json(result);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Error fetching games' });
  }
});

module.exports = router;
