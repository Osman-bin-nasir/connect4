const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
    singlePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    crowdId: { type: String, default: 'crowd' },
    // 6 rows, 7 columns. 0=empty, 1=player, 2=crowd
    board: {
        type: [[Number]],
        default: () => Array(6).fill().map(() => Array(7).fill(0))
    },
    currentTurn: { type: String, enum: ['player', 'crowd'], default: 'player' },
    winner: { type: String, enum: ['player', 'crowd', 'draw', null], default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
