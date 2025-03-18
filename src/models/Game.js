const mongoose = require('mongoose');
const { STEAM_TYPES } = require('../config/steamConstants');
const logger = require('../utils/logger');

const priceSchema = new mongoose.Schema({
    currency: { type: String, required: true },
    initial: { type: Number },
    final: { type: Number },
    discount_percent: { type: Number, default: 0 },
    initial_formatted: { type: String },
    final_formatted: { type: String },
    lastChecked: { type: Date, default: Date.now }
}, { _id: false });

const metacriticSchema = new mongoose.Schema({
    score: { type: Number },
    url: { type: String }
}, { _id: false });

const recommendationsSchema = new mongoose.Schema({
    total: { type: Number, default: 0 }
}, { _id: false });

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
    metacritic: metacriticSchema,
    recommendations: recommendationsSchema,
    priceHistory: [priceSchema],
    lastUpdated: { type: Date, default: Date.now, index: true }
}, { 
    autoIndex: false,
    timestamps: true
});

gameSchema.index({ name: 1 });
gameSchema.index({ 'price.discount_percent': 1 });
gameSchema.index({ genres: 1 });
gameSchema.index({ publishers: 1 });
gameSchema.index({ developers: 1 });
gameSchema.index({ 'metacritic.score': 1 });
gameSchema.index({ lastUpdated: 1 });
gameSchema.index({ appid: 1 }, { unique: true });

gameSchema.statics.createIndexesInBackground = async function() {
    try {
        logger.info('Creating Game model indexes in background...');
        await this.createIndexes({ background: true });
        logger.info('Game model indexes created successfully');
        return true;
    } catch (error) {
        logger.error(`Error creating Game model indexes: ${error.message}`);
        return false;
    }
};

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
