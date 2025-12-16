const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    name: { type: String, default: 'Untitled Game' },
    status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
    singlePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    crowdId: { type: String, default: 'crowd' },
    turnDuration: { type: Number, default: 30 }, // Seconds. 0 for infinite.
    // 6 rows, 7 columns. 0=empty, 1=player, 2=crowd
    board: {
        type: [[Number]],
        default: () => Array(6).fill().map(() => Array(7).fill(0))
    },
    currentTurn: { type: String, enum: ['player', 'crowd'], default: 'player' },
    winner: { type: String, enum: ['player', 'crowd', 'draw', null], default: null },
    moves: [{
        col: { type: Number, required: true },
        player: { type: String, enum: ['player', 'crowd'], required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    // Community features
    hearts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who hearted this game
    plays: { type: Number, default: 0 }, // Total number of plays/views
    isPublic: { type: Boolean, default: true }, // Public or private game
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
