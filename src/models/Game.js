const mongoose = require('mongoose');

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
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
