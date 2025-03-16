/**
 * Swagger configuration for API documentation
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SalesAllSales API',
      version: '1.0.0',
      description: 'API for managing Steam games information and Twitter integration',
      contact: {
        name: 'Support',
        email: 'support@salesallsales.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        Game: {
          type: 'object',
          properties: {
            appid: {
              type: 'number',
              description: 'Steam application ID'
            },
            name: {
              type: 'string',
              description: 'Game name'
            },
            type: {
              type: 'string',
              enum: ['game', 'games', 'dlc', 'package'],
              description: 'Product type'
            },
            required_age: {
              type: 'number',
              description: 'Required age to play'
            },
            developers: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of developers'
            },
            publishers: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of publishers'
            },
            genres: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of genres'
            },
            header_image: {
              type: 'string',
              description: 'URL to game header image'
            },
            website: {
              type: 'string',
              description: 'Game website URL'
            },
            lastUpdated: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        TwitterCredential: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'Identificador único del usuario'
            },
            accessToken: {
              type: 'string',
              description: 'Token de acceso para la API de Twitter'
            },
            refreshToken: {
              type: 'string',
              description: 'Token de actualización para renovar el access token'
            },
            tokenExpiry: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de expiración del token de acceso'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación del registro'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización del registro'
            }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number'
            },
            pageSize: {
              type: 'integer',
              description: 'Number of items per page'
            },
            total: {
              type: 'integer',
              description: 'Total number of items'
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js', './src/models/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, { explorer: true })
};
