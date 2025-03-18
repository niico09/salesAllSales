const mongoose = require('mongoose');

const blacklistGameSchema = new mongoose.Schema({
  appid: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  attemptCount: {
    type: Number,
    default: 1
  },
  lastAttempt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

blacklistGameSchema.index({ appid: 1 }, { unique: true });

const BlacklistGame = mongoose.model('BlacklistGame', blacklistGameSchema);

module.exports = BlacklistGame;
