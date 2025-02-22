const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    appid: {
        type: Number,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['game', 'games', 'dlc', 'package'],
        required: false // Cambiado a false para permitir guardado inicial sin type
    },
    name: {
        type: String,
        required: true
    },
    required_age: {
        type: Number,
        default: 0
    },
    developers: [{
        type: String
    }],
    publishers: [{
        type: String
    }],
    packages: [{
        type: Number
    }],
    platforms: {
        type: Map,
        of: Boolean
    },
    genres: [{
        type: String
    }],
    dlc: [{
        type: Number
    }],
    header_image: {
        type: String
    },
    website: {
        type: String
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Game', gameSchema);
