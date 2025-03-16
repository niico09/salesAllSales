/**
 * Controlador para manejar las operaciones relacionadas con Twitter
 * @module controllers/twitterController
 */

const twitterService = require('../services/twitterService');
const TwitterCredential = require('../models/TwitterCredential');
const logger = require('../utils/logger');

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
 *       500:
 *         description: Error del servidor
 */
const getAuthUrl = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Se requiere un userId' });
    }
    
    // Guardamos el userId en la sesión para recuperarlo en el callback
    req.session = req.session || {};
    req.session.twitterUserId = userId;
    
    // Si el usuario necesita reautorización, limpiamos sus credenciales antiguas
    const credential = await TwitterCredential.findOne({ userId });
    if (credential && credential.needsReauthorization) {
      logger.info(`Limpiando credenciales antiguas para reautorización del usuario: ${userId}`);
      await TwitterCredential.deleteOne({ userId });
    }
    
    // Obtenemos la URL de autorización
    const authUrl = twitterService.getAuthorizationUrl();
    
    logger.info(`Redirigiendo al usuario ${userId} a la página de autorización de Twitter`);
    
    // Redirigimos al usuario a la página de autorización de Twitter
    return res.redirect(authUrl);
  } catch (error) {
    logger.error(`Error al iniciar autorización de Twitter: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};

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
const handleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    // Verificamos si hay un error en la respuesta
    if (error) {
      logger.error(`Error en callback de Twitter: ${error}`);
      return res.status(400).json({ error: 'Autorización denegada o cancelada' });
    }
    
    // Verificamos que tengamos el código de autorización
    if (!code) {
      return res.status(400).json({ error: 'Falta el código de autorización' });
    }
    
    // Recuperamos el userId de la sesión
    const userId = req.session?.twitterUserId;
    
    if (!userId) {
      return res.status(400).json({ error: 'No se pudo identificar al usuario' });
    }
    
    // Obtenemos los tokens de acceso
    await twitterService.getAccessToken(code, userId);
    
    logger.info(`Autorización de Twitter completada para el usuario ${userId}`);
    
    // Respondemos con éxito
    return res.status(200).json({
      success: true,
      message: 'Autorización de Twitter completada correctamente'
    });
  } catch (error) {
    logger.error(`Error en callback de Twitter: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};

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
const postTweet = async (req, res) => {
  try {
    const { userId, text } = req.body;
    
    // Validamos los parámetros
    if (!userId || !text) {
      return res.status(400).json({ error: 'Se requieren userId y text' });
    }
    
    // Validamos la longitud del tweet (máximo 280 caracteres)
    if (text.length > 280) {
      return res.status(400).json({ error: 'El tweet no puede exceder los 280 caracteres' });
    }
    
    // Verificamos si el usuario necesita reautorización
    const credential = await TwitterCredential.findOne({ userId });
    if (credential && credential.needsReauthorization) {
      return res.status(401).json({ 
        error: 'Se requiere reautorización',
        authUrl: `/api/twitter/auth?userId=${userId}`,
        needsReauthorization: true
      });
    }
    
    // Publicamos el tweet
    const result = await twitterService.postTweet(userId, text);
    
    logger.info(`Tweet publicado correctamente por el usuario ${userId}`);
    
    // Respondemos con éxito
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error al publicar tweet: ${error.message}`);
    
    // Manejamos diferentes tipos de errores
    if (error.message.includes('No se encontraron credenciales')) {
      return res.status(401).json({ 
        error: 'Usuario no autorizado. Debe completar el proceso de autorización primero.',
        authUrl: `/api/twitter/auth?userId=${req.body.userId}`
      });
    }
    
    if (error.message.includes('Se requiere reautorización')) {
      return res.status(401).json({ 
        error: 'Se requiere reautorización. El token ha expirado o es inválido.',
        authUrl: `/api/twitter/auth?userId=${req.body.userId}`,
        needsReauthorization: true
      });
    }
    
    return res.status(500).json({ error: error.message });
  }
};

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
 *                 needsReauthorization:
 *                   type: boolean
 *                 authUrl:
 *                   type: string
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
const getAuthStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Se requiere un userId' });
    }
    
    // Buscamos las credenciales del usuario
    const credential = await TwitterCredential.findOne({ userId });
    
    // Preparamos la URL de autorización si es necesario
    const authUrl = credential && !credential.needsReauthorization 
      ? null 
      : `/api/twitter/auth?userId=${userId}`;
    
    // Respondemos con el estado de autorización
    return res.status(200).json({
      authorized: !!credential && !credential.needsReauthorization,
      expiresAt: credential ? credential.tokenExpiry : null,
      needsReauthorization: credential ? credential.needsReauthorization : false,
      authUrl: authUrl
    });
  } catch (error) {
    logger.error(`Error al verificar estado de autorización: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  postTweet,
  getAuthStatus
};
