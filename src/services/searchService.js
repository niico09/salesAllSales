const Game = require('../models/Game');
const SteamService = require('./steamService');
const { STEAM_FILTERS, STEAM_TYPES } = require('../config/steamConstants');
const { DEFAULT_PAGE_SIZE } = require('../config/constants');

class SearchService {
    async searchGames(filters = {}) {
        try {
            console.log('Filtros recibidos:', filters); // Debug

            const query = this._buildQuery(filters);
            console.log('Query construida:', JSON.stringify(query, null, 2)); // Debug

            const page = parseInt(filters.page) || 1;
            const pageSize = parseInt(filters.pageSize) || DEFAULT_PAGE_SIZE;
            const skip = (page - 1) * pageSize;

            // Primero verificar cuántos documentos hay en total
            const totalCount = await Game.countDocuments({});
            console.log('Total de juegos en la base de datos:', totalCount); // Debug

            // Hacer la consulta principal
            const [games, total] = await Promise.all([
                Game.find(query)
                    .select('appid name type isMainType is_free developers publishers genres price_overview header_image lastUpdated')
                    .skip(skip)
                    .limit(pageSize),
                Game.countDocuments(query)
            ]);

            console.log(`Encontrados ${games.length} juegos`); // Debug

            // Si no hay juegos, devolver respuesta vacía
            if (!games.length) {
                return {
                    games: [],
                    pagination: {
                        page,
                        pageSize,
                        total: 0,
                        totalPages: 0
                    }
                };
            }

            // Iniciar la actualización de juegos en segundo plano
            this._updateGamesDataAsync(games);

            // Devolver los datos inmediatamente
            return {
                games: games.map(game => game.toObject()),
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('Error en searchGames:', error);
            throw error;
        }
    }

    async _updateGamesDataAsync(games) {
        const currentTime = new Date();
        const TWO_HOURS = 2 * 60 * 60 * 1000;

        for (const game of games) {
            try {
                if (this._needsUpdate(game, currentTime, TWO_HOURS) || this._isIncomplete(game)) {
                    console.log(`Actualizando juego en segundo plano: ${game.name} (${game.appid})`); // Debug
                    const updatedData = await SteamService.getGameDetails(game.appid, game.name);
                    
                    if (updatedData) {
                        // Actualizar solo los campos que vienen en updatedData
                        Object.keys(updatedData).forEach(key => {
                            if (updatedData[key] !== undefined) {
                                game[key] = updatedData[key];
                            }
                        });
                        
                        game.lastUpdated = new Date();
                        await game.save();
                        console.log(`Juego actualizado con éxito en segundo plano: ${game.name}`);
                    }
                }
            } catch (error) {
                console.error(`Error actualizando el juego ${game.appid} en segundo plano:`, error);
            }
        }
    }

    _needsUpdate(game, currentTime, updateInterval) {
        if (!game.lastUpdated) return true;
        return (currentTime - new Date(game.lastUpdated)) > updateInterval;
    }

    _isIncomplete(game) {
        return !game.type || 
               !game.developers?.length || 
               !game.publishers?.length || 
               !game.genres?.length || 
               !game.header_image ||
               game.is_free === undefined;
    }

    _buildQuery(filters = {}) {
        const query = {
            // Verificar que type existe y no es unknown
            type: { 
                $exists: true,
                $ne: STEAM_TYPES.UNKNOWN 
            }
        };

        // Por defecto, no aplicamos ningún filtro de tipo
        if (filters.includeAllTypes === false) {
            query.isMainType = true;
        }

        if (filters.genre) {
            query.genres = filters.genre;
        }

        if (filters.publisher) {
            query.publishers = filters.publisher;
        }

        if (filters.developer) {
            query.developers = filters.developer;
        }

        if (filters.startsWith) {
            query.name = new RegExp(`^${filters.startsWith}`, 'i');
        }

        if (filters.isFree !== undefined) {
            query.is_free = filters.isFree === 'true';
        }

        // Solo agregar filtros de descuento si el juego no es gratuito
        if (filters.discountPercentage || filters.minDiscount || filters.maxDiscount) {
            query.is_free = false;
            
            if (filters.discountPercentage) {
                query['price_overview.discount_percent'] = parseInt(filters.discountPercentage);
            } else if (filters.minDiscount) {
                query['price_overview.discount_percent'] = { $gte: parseInt(filters.minDiscount) };
            } else if (filters.maxDiscount) {
                query['price_overview.discount_percent'] = { $lte: parseInt(filters.maxDiscount) };
            }
        }

        return query;
    }
}

module.exports = new SearchService();
