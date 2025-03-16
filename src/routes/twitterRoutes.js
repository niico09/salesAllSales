/**
 * Rutas para la funcionalidad de Twitter
 * @module routes/twitterRoutes
 */

const express = require('express');
const router = express.Router();
const twitterController = require('../controllers/twitterController');

/**
 * @swagger
 * tags:
 *   name: Twitter
 *   description: Operaciones relacionadas con la API de Twitter
 */

/**
 * @swagger
 * /api/twitter/auth:
 *   get:
 *     summary: Inicia el proceso de autorización de Twitter
 *     tags: [Twitter]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: Identificador del usuario
 *     responses:
 *       302:
 *         description: Redirecciona al usuario a la página de autorización de Twitter
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
router.get('/auth', twitterController.getAuthUrl);

/**
 * @swagger
 * /api/twitter/callback:
 *   get:
 *     summary: Maneja el callback de autorización de Twitter
 *     tags: [Twitter]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Código de autorización
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: true
 *         description: Estado para verificación CSRF
 *     responses:
 *       200:
 *         description: Autorización exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
router.get('/callback', twitterController.handleCallback);

/**
 * @swagger
 * /api/twitter/tweet:
 *   post:
 *     summary: Publica un tweet
 *     tags: [Twitter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - text
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Identificador del usuario
 *               text:
 *                 type: string
 *                 description: Texto del tweet
 *     responses:
 *       200:
 *         description: Tweet publicado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/tweet', twitterController.postTweet);

/**
 * @swagger
 * /api/twitter/status:
 *   get:
 *     summary: Verifica el estado de autorización de un usuario
 *     tags: [Twitter]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: Identificador del usuario
 *     responses:
 *       200:
 *         description: Estado de autorización
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authorized:
 *                   type: boolean
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
router.get('/status', twitterController.getAuthStatus);

module.exports = router;
