/**
 * Servicio para interactuar con la API de Twitter
 * @module services/twitterService
 */

const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const TwitterCredential = require('../models/TwitterCredential');
const logger = require('../utils/logger');

/**
 * Clase para manejar las interacciones con la API de Twitter
 * @class TwitterService
 */
class TwitterService {
  /**
   * Crea una instancia del servicio de Twitter
   * @constructor
   */
  constructor() {
    const requiredEnvVars = ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      const errorMsg = `Faltan credenciales de Twitter en la configuración: ${missingEnvVars.join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    this.clientId = process.env.TWITTER_CLIENT_ID;
    this.clientSecret = process.env.TWITTER_CLIENT_SECRET;
    this.redirectUri = process.env.TWITTER_REDIRECT_URI;
    this.baseUrl = 'https://api.twitter.com';
    this.scope = 'tweet.read tweet.write users.read offline.access';
    this.state = this._generateState();
    
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }
  
  /**
   * Genera un estado aleatorio para protección CSRF
   * @private
   * @returns {string} Estado aleatorio
   */
  _generateState() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Realiza una solicitud HTTP con reintentos automáticos
   * @private
   * @param {string} method - Método HTTP
   * @param {string} url - URL de la solicitud
   * @param {Object} data - Datos para enviar
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} Respuesta de la solicitud
   * @throws {Error} Si la solicitud falla
   */
  async _makeRequestWithRetry(method, url, data, config = {}) {
    let lastError;
    let retryCount = 0;
    
    while (retryCount <= this.maxRetries) {
      try {
        const response = await axios[method](url, data, config);
        return response.data;
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this._shouldRetryRequest(error, retryCount);
        
        if (!shouldRetry) {
          break;
        }
        
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn(`Reintentando solicitud a ${url} después de ${delay}ms (intento ${retryCount + 1}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryCount++;
      }
    }
    
    logger.error(`Error en solicitud a ${url} después de ${retryCount} intentos: ${lastError.message}`);
    throw lastError;
  }
  
  /**
   * Determina si una solicitud debe ser reintentada
   * @private
   * @param {Error} error - Error de la solicitud
   * @param {number} retryCount - Número de reintentos realizados
   * @returns {boolean} True si la solicitud debe ser reintentada
   */
  _shouldRetryRequest(error, retryCount) {
    if (retryCount >= this.maxRetries) {
      return false;
    }
    
    if (!error.response) {
      return true;
    }
    
    const status = error.response.status;
    
    if (status >= 500 && status < 600) {
      return true;
    }
    
    if (status === 429) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Obtiene la URL de autorización para Twitter
   * @returns {string} URL de autorización
   */
  getAuthorizationUrl() {
    const params = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state: this.state,
      code_challenge: 'challenge',
      code_challenge_method: 'plain'
    };
    
    return `${this.baseUrl}/2/oauth2/authorize?${querystring.stringify(params)}`;
  }
  
  /**
   * Obtiene tokens de acceso usando el código de autorización
   * @param {string} code - Código de autorización
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Tokens de acceso
   * @throws {Error} Si hay un error al obtener los tokens
   */
  async getAccessToken(code, userId) {
    try {
      logger.info(`Obteniendo tokens de acceso para el usuario ${userId}`);
      
      const params = {
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code_verifier: 'challenge'
      };
      
      const response = await this._makeRequestWithRetry('post', `${this.baseUrl}/2/oauth2/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
      });
      
      const expiresIn = response.expires_in || 7200;
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      
      await TwitterCredential.findOneAndUpdate(
        { userId },
        {
          userId,
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          tokenExpiry,
          needsReauthorization: false
        },
        { upsert: true, new: true }
      );
      
      logger.info(`Tokens de acceso guardados para el usuario ${userId}`);
      
      return response;
    } catch (error) {
      logger.error(`Error al obtener tokens de acceso: ${error.message}`);
      throw new Error(`Error al obtener tokens de acceso: ${error.message}`);
    }
  }
  
  /**
   * Refresca el token de acceso usando el refresh token
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Nuevo token de acceso
   * @throws {Error} Si hay un error al refrescar el token
   */
  async refreshAccessToken(userId) {
    try {
      logger.info(`Refrescando token de acceso para el usuario ${userId}`);
      
      const credential = await TwitterCredential.findOne({ userId });
      
      if (!credential || !credential.refreshToken) {
        throw new Error('No se encontraron credenciales válidas para el usuario');
      }
      
      if (credential.needsReauthorization) {
        throw new Error('Se requiere reautorización. El token de renovación ha expirado o es inválido.');
      }
      
      const params = {
        refresh_token: credential.refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId
      };
      
      const response = await this._makeRequestWithRetry('post', `${this.baseUrl}/2/oauth2/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
      });
      
      const expiresIn = response.expires_in || 7200;
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      
      const updateData = {
        accessToken: response.access_token,
        tokenExpiry
      };
      
      if (response.refresh_token) {
        updateData.refreshToken = response.refresh_token;
      }
      
      await TwitterCredential.findOneAndUpdate(
        { userId },
        updateData,
        { new: true }
      );
      
      logger.info(`Token de acceso refrescado para el usuario ${userId}`);
      
      return response.access_token;
    } catch (error) {
      logger.error(`Error al refrescar token de acceso: ${error.message}`);
      
      if (error.response && (error.response.status === 400 || error.response.status === 401)) {
        logger.warn(`Marcando credenciales como inválidas para el usuario ${userId}`);
        await TwitterCredential.findOneAndUpdate(
          { userId },
          { needsReauthorization: true },
          { new: true }
        );
        throw new Error('Se requiere reautorización. El token de renovación ha expirado o es inválido.');
      }
      
      throw new Error(`Error al refrescar token de acceso: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un token de acceso válido, refrescándolo si es necesario
   * @param {string} userId - ID del usuario
   * @returns {Promise<string>} Token de acceso válido
   * @throws {Error} Si no hay credenciales o si hay un error
   */
  async getValidAccessToken(userId) {
    try {
      const credential = await TwitterCredential.findOne({ userId });
      
      if (!credential) {
        throw new Error('No se encontraron credenciales para el usuario');
      }
      
      if (credential.needsReauthorization) {
        throw new Error('Se requiere reautorización. El token de renovación ha expirado o es inválido.');
      }
      
      const now = new Date();
      const expiryBuffer = 5 * 60 * 1000;
      
      if (credential.tokenExpiry && credential.tokenExpiry.getTime() - now.getTime() < expiryBuffer) {
        logger.info(`Token próximo a expirar para el usuario ${userId}, refrescando...`);
        return await this.refreshAccessToken(userId);
      }
      
      return credential.accessToken;
    } catch (error) {
      logger.error(`Error al obtener token válido: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Publica un tweet
   * @param {string} userId - ID del usuario
   * @param {string} text - Texto del tweet
   * @returns {Promise<Object>} Respuesta de la API de Twitter
   * @throws {Error} Si hay un error al publicar el tweet
   */
  async postTweet(userId, text) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      
      const tweetData = {
        text
      };
      
      return await this._makeRequestWithRetry('post', `${this.baseUrl}/2/tweets`, tweetData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      if (error.response && error.response.status === 401 && !error.message.includes('reautorización')) {
        try {
          logger.info(`Token expirado para el usuario ${userId}, refrescando y reintentando...`);
          await this.refreshAccessToken(userId);
          return await this.postTweet(userId, text);
        } catch (refreshError) {
          logger.error(`Error al reintentar después de refrescar token: ${refreshError.message}`);
          throw refreshError;
        }
      }
      
      logger.error(`Error al publicar tweet: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene información del usuario de Twitter
   * @param {string} userId - ID del usuario en nuestra aplicación
   * @returns {Promise<Object>} Información del usuario de Twitter
   * @throws {Error} Si hay un error al obtener la información
   */
  async getUserInfo(userId) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      
      return await this._makeRequestWithRetry('get', `${this.baseUrl}/2/users/me`, null, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      if (error.response && error.response.status === 401 && !error.message.includes('reautorización')) {
        try {
          logger.info(`Token expirado para el usuario ${userId}, refrescando y reintentando...`);
          await this.refreshAccessToken(userId);
          return await this.getUserInfo(userId);
        } catch (refreshError) {
          logger.error(`Error al reintentar después de refrescar token: ${refreshError.message}`);
          throw refreshError;
        }
      }
      
      logger.error(`Error al obtener información del usuario: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verifica si un usuario tiene credenciales válidas
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} True si el usuario tiene credenciales válidas
   */
  async hasValidCredentials(userId) {
    try {
      const credential = await TwitterCredential.findOne({ userId });
      return !!credential && !credential.needsReauthorization;
    } catch (error) {
      logger.error(`Error al verificar credenciales: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Marca las credenciales de un usuario como inválidas
   * @param {string} userId - ID del usuario
   * @returns {Promise<void>}
   */
  async invalidateCredentials(userId) {
    try {
      logger.info(`Invalidando credenciales para el usuario ${userId}`);
      await TwitterCredential.findOneAndUpdate(
        { userId },
        { needsReauthorization: true },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error al invalidar credenciales: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new TwitterService();
