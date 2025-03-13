/**
 * Routes for Steam games related endpoints
 * Follows SOLID principles and clean code practices
 */
const express = require('express');
const router = express.Router();
const steamController = require('../controllers/steamController');

/**
 * @swagger
 * /steam-games:
 *   get:
 *     summary: Obtiene un listado de juegos de Steam
 *     description: Retorna una lista paginada de juegos de Steam con categorización
 *     tags: [Steam]
 *     parameters:
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
 *           default: 50
 *           maximum: 50
 *         description: Número de elementos por página (máximo 50)
 *     responses:
 *       200:
 *         description: Lista de juegos de Steam
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
 *         description: Error del servidor
 */
router.get('/steam-games', steamController.getSteamGames);

/**
 * @swagger
 * /check-differences:
 *   get:
 *     summary: Comprueba diferencias entre la API de Steam y la base de datos
 *     description: Retorna estadísticas sobre juegos presentes en Steam pero no en la base de datos y viceversa
 *     tags: [Steam]
 *     responses:
 *       200:
 *         description: Estadísticas de diferencias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statistics:
 *                   type: object
 *                 differences:
 *                   type: object
 *       500:
 *         description: Error del servidor
 */
router.get('/check-differences', steamController.checkDifferences);

/**
 * @swagger
 * /stored-games:
 *   get:
 *     summary: Obtiene juegos almacenados en la base de datos
 *     description: Retorna una lista paginada de juegos almacenados con opciones de filtrado
 *     tags: [Steam]
 *     parameters:
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
 *           default: 50
 *           maximum: 50
 *         description: Número de elementos por página (máximo 50)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de juego
 *       - in: query
 *         name: withType
 *         schema:
 *           type: boolean
 *         description: Filtrar por presencia de tipo
 *     responses:
 *       200:
 *         description: Lista de juegos almacenados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pagination:
 *                   type: object
 *                 games:
 *                   type: array
 *       500:
 *         description: Error del servidor
 */
router.get('/stored-games', steamController.getStoredGames);

module.exports = router;
