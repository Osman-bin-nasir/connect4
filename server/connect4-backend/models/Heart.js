const mongoose = require('mongoose');

const heartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    createdAt: { type: Date, default: Date.now }
});

// Ensure a user can only heart a game once
heartSchema.index({ user: 1, game: 1 }, { unique: true });

module.exports = mongoose.model('Heart', heartSchema);
