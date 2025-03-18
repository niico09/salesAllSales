const Game = require('../models/Game');
const SteamService = require('./steamService');
const { STEAM_FILTERS, STEAM_TYPES } = require('../config/steamConstants');
const { PAGINATION } = require('../config/constants');

class SearchService {
  async searchGames(filters = {}, page = PAGINATION.DEFAULT_PAGE, pageSize = PAGINATION.DEFAULT_PAGE_SIZE) {
    try {
        console.log('Received filters:', filters); 

        const query = this._buildQuery(filters);
        console.log('Built query:', JSON.stringify(query, null, 2)); 

        const validPage = parseInt(page) || PAGINATION.DEFAULT_PAGE;
        const validPageSize = Math.min(parseInt(pageSize) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
        const skip = (validPage - 1) * validPageSize;

        const totalCount = await Game.countDocuments({});
        console.log('Total games in database:', totalCount); 

        const [games, total] = await Promise.all([
            Game.find(query)
                .select('appid name type isMainType is_free developers publishers genres price_overview header_image lastUpdated')
                .skip(skip)
                .limit(validPageSize),
            Game.countDocuments(query)
        ]);

        console.log(`Found ${games.length} games`); 

        if (!games.length) {
            return {
                games: [],
                pagination: {
                    page: validPage,
                    pageSize: validPageSize,
                    total: 0,
                    totalPages: 0
                }
            };
        }

        // this._updateGamesDataAsync(games);

        return {
            games: games.map(game => game.toObject()),
            pagination: {
                page: validPage,
                pageSize: validPageSize,
                total,
                totalPages: Math.ceil(total / validPageSize)
            }
        };
    } catch (error) {
        console.error('Error in searchGames:', error);
        throw error;
    }
}

async _updateGamesDataAsync(games) {
    const currentTime = new Date();
    const TWO_HOURS = 2 * 60 * 60 * 1000;

    for (const game of games) {
        try {
            if (this._needsUpdate(game, currentTime, TWO_HOURS) || this._isIncomplete(game)) {
                console.log(`Updating game in background: ${game.name} (${game.appid})`);
                const updatedData = await SteamService.getGameDetails(game.appid, game.name);
                
                if (updatedData) {
                    Object.keys(updatedData).forEach(key => {
                        if (updatedData[key] !== undefined) {
                            game[key] = updatedData[key];
                        }
                    });
                    
                    game.lastUpdated = new Date();
                    await game.save();
                    console.log(`Game successfully updated in background: ${game.name}`);
                }
            }
        } catch (error) {
            console.error(`Error updating game ${game.appid} in background:`, error);
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
        type: { 
            $exists: true,
            $ne: STEAM_TYPES.UNKNOWN 
        }
    };

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

async getUniqueGenres() {
    try {
        const genres = await Game.distinct('genres');
        return genres.filter(genre => genre).sort();
    } catch (error) {
        console.error('Error getting unique genres:', error);
        return [];
    }
}

async getUniquePublishers() {
    try {
        const publishers = await Game.distinct('publishers');
        return publishers.filter(publisher => publisher).sort();
    } catch (error) {
        console.error('Error getting unique publishers:', error);
        return [];
    }
}

async getUniqueDevelopers() {
    try {
        const developers = await Game.distinct('developers');
        return developers.filter(developer => developer).sort();
    } catch (error) {
        console.error('Error getting unique developers:', error);
        return [];
    }
}
}

module.exports = new SearchService();
