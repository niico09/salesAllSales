const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     TwitterCredential:
 *       type: object
 *       required:
 *         - userId
 *         - accessToken
 *         - refreshToken
 *       properties:
 *         userId:
 *           type: string
 *           description: Identificador único del usuario
 *         accessToken:
 *           type: string
 *           description: Token de acceso para la API de Twitter
 *         refreshToken:
 *           type: string
 *           description: Token de renovación para obtener nuevos tokens de acceso
 *         tokenExpiry:
 *           type: string
 *           format: date-time
 *           description: Fecha de expiración del token de acceso
 *         needsReauthorization:
 *           type: boolean
 *           description: Indica si el usuario necesita volver a autorizar la aplicación
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del registro
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización del registro
 */

const twitterCredentialSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  tokenExpiry: {
    type: Date,
    required: true
  },
  needsReauthorization: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TwitterCredential', twitterCredentialSchema);
