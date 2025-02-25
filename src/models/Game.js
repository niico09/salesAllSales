const mongoose = require('mongoose');

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

const gameSchema = new mongoose.Schema({
    appid: { type: Number, required: true, unique: true },
    type: { type: String, enum: ['game', 'games', 'dlc', 'package'], required: false },
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
    priceHistory: [priceSchema],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
