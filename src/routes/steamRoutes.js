const express = require('express');
const router = express.Router();
const steamController = require('../controllers/steamController');

/**
 * @swagger
 * /api/steam/steam-games:
 *   get:
 *     summary: Get a list of Steam games
 *     description: Returns a paginated list of Steam games with categorization
 *     tags: [Steam]
 *     parameters:
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
 *           default: 50
 *           maximum: 50
 *         description: Number of items per page (maximum 50)
 *     responses:
 *       200:
 *         description: List of Steam games
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalGames:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 total:
 *                   type: integer
 *                 categorizedGames:
 *                   type: object
 *                 mongoStats:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/steam-games', steamController.getSteamGames);

/**
 * @swagger
 * /api/steam/game/{appid}:
 *   get:
 *     summary: Get details of a specific game
 *     description: Returns detailed information about a game, including Metacritic data and recommendations.
 *     tags: [Steam]
 *     parameters:
 *       - in: path
 *         name: appid
 *         required: true
 *         schema:
 *           type: integer
 *         description: Steam application ID
 *     responses:
 *       200:
 *         description: Game details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appid:
 *                   type: integer
 *                   example: 3534180
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 metacritic:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: integer
 *                       nullable: true
 *                     url:
 *                       type: string
 *                       nullable: true
 *                 recommendations:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                 developers:
 *                   type: array
 *                   items:
 *                     type: string
 *                 publishers:
 *                   type: array
 *                   items:
 *                     type: string
 *                 genres:
 *                   type: array
 *                   items:
 *                     type: string
 *                 price_overview:
 *                   type: object
 *                   properties:
 *                     currency:
 *                       type: string
 *                     initial:
 *                       type: integer
 *                     final:
 *                       type: integer
 *                     discount_percent:
 *                       type: integer
 *                     initial_formatted:
 *                       type: string
 *                     final_formatted:
 *                       type: string
 *       404:
 *         description: Game not found
 *       500:
 *         description: Server error
 */
router.get('/game/:appid', steamController.getGameDetails);

/**
 * @swagger
 * /api/steam/stored-games:
 *   get:
 *     summary: Get games stored in the database
 *     description: Returns a list of games stored in the database with pagination and filtering options
 *     tags: [Steam]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of items per page (maximum 100)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [game, dlc, package]
 *         description: Filter by game type
 *     responses:
 *       200:
 *         description: List of stored games
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
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/stored-games', steamController.getStoredGames);

/**
 * @swagger
 * /api/steam/check-differences:
 *   get:
 *     summary: Check differences between Steam API and database
 *     description: Compares the games in the Steam API with those in the database and returns statistics
 *     tags: [Steam]
 *     responses:
 *       200:
 *         description: Differences statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSteamGames:
 *                   type: integer
 *                 totalStoredGames:
 *                   type: integer
 *                 missingGames:
 *                   type: integer
 *                 newGames:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       appid:
 *                         type: integer
 *                       name:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/check-differences', steamController.checkDifferences);

/**
 * @swagger
 * /api/steam/sync-new-games:
 *   post:
 *     summary: Sync new games from Steam API to database
 *     description: Fetches new games from Steam API and adds them to the database
 *     tags: [Steam]
 *     responses:
 *       200:
 *         description: Sync results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 syncedGames:
 *                   type: integer
 *                 timeElapsed:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/sync-new-games', steamController.syncNewGames);

/**
 * @swagger
 * /api/steam/update-all-games:
 *   post:
 *     summary: Update all games in the database
 *     description: Updates all games in the database with the latest information from Steam API
 *     tags: [Steam]
 *     responses:
 *       200:
 *         description: Update results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 updatedGames:
 *                   type: integer
 *                 timeElapsed:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/update-all-games', steamController.updateAllGames);

module.exports = router;
