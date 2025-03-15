const mongoose = require('mongoose');
const { STEAM_TYPES } = require('../config/steamConstants');

const priceOverviewSchema = new mongoose.Schema({
    currency: { type: String },
    initial: { type: Number },
    final: { type: Number },
    discount_percent: { type: Number },
    initial_formatted: { type: String },
    final_formatted: { type: String }
});

const priceSchema = new mongoose.Schema({
    currency: { type: String, required: true },
    initial: { type: Number },
    final: { type: Number },
    discount_percent: { type: Number, default: 0 },
    lastChecked: { type: Date, default: Date.now }
});

/**
 * Esquema para la información de Metacritic
 */
const metacriticSchema = new mongoose.Schema({
    score: { type: Number },
    url: { type: String }
});

/**
 * Esquema para las recomendaciones
 */
const recommendationsSchema = new mongoose.Schema({
    total: { type: Number, default: 0 }
});

const gameSchema = new mongoose.Schema({
    appid: { type: Number, required: true, unique: true },
    type: { 
        type: String, 
        enum: Object.values(STEAM_TYPES), 
        default: STEAM_TYPES.UNKNOWN,
        index: true
    },
    isMainType: { 
        type: Boolean, 
        default: false,
        index: true
    },
    is_free: {
        type: Boolean,
        default: false,
        index: true
    },
    name: { type: String, required: true },
    required_age: { type: Number },
    developers: [String],
    publishers: [String],
    packages: [Number],
    platforms: {
        windows: Boolean,
        mac: Boolean,
        linux: Boolean
    },
    genres: [String],
    dlc: [Number],
    header_image: String,
    website: String,
    price: priceSchema,
    price_overview: priceOverviewSchema,
    metacritic: metacriticSchema,
    recommendations: recommendationsSchema,
    priceHistory: [priceSchema],
    lastUpdated: { type: Date, default: Date.now }
});

gameSchema.index({ name: 1 });
gameSchema.index({ 'price_overview.discount_percent': 1 });
gameSchema.index({ genres: 1 });
gameSchema.index({ publishers: 1 });
gameSchema.index({ developers: 1 });
gameSchema.index({ 'metacritic.score': 1 });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
