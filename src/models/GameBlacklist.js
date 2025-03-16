const mongoose = require('mongoose');

const GameBlacklistSchema = new mongoose.Schema({
    appid: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    reason: {
        type: String,
        default: 'No data available'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const GameBlacklist = mongoose.model('GameBlacklist', GameBlacklistSchema);

module.exports = GameBlacklist;
