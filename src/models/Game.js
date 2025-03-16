const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
    platform: {
        type: String,
        enum: ['steam', 'xbox', 'playstation'],
        required: true,
        default: 'steam'
    },
    currency: String,
    initial: Number,
    final: Number,
    discount_percent: {
        type: Number,
        default: 0
    },
    initial_formatted: String,
    final_formatted: String,
    lastChecked: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const metacriticSchema = new mongoose.Schema({
    score: Number,
    url: String
}, { _id: false });

const recommendationsSchema = new mongoose.Schema({
    total: {
        type: Number,
        default: 0
    }
}, { _id: false });

const GameSchema = new mongoose.Schema({
    appid: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    type: {
        type: String,
        enum: ['game', 'dlc', 'demo', 'application', 'music', 'video', 'hardware', 'package', 'bundle', 'tool', 'unknown'],
        default: 'unknown'
    },
    isMainType: {
        type: Boolean,
        default: false
    },
    is_free: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        required: true,
        index: true
    },
    required_age: {
        type: Number,
        default: 0
    },
    developers: [String],
    publishers: [String],
    packages: [Number],
    platforms: {
        windows: {
            type: Boolean,
            default: false
        },
        mac: {
            type: Boolean,
            default: false
        },
        linux: {
            type: Boolean,
            default: false
        }
    },
    genres: [String],
    dlc: [Number],
    header_image: String,
    website: String,
    metacritic: {
        type: metacriticSchema,
        default: () => ({})
    },
    recommendations: {
        type: recommendationsSchema,
        default: () => ({})
    },
    prices: {
        type: [priceSchema],
        default: []
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

GameSchema.index({ 'prices.platform': 1 });
GameSchema.index({ 'prices.discount_percent': 1 });

const Game = mongoose.model('Game', GameSchema);

module.exports = Game;
