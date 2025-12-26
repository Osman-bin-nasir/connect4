const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    name: { type: String, default: 'Untitled Game' },
    status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
    gameMode: { type: String, enum: ['crowd', '1v1', 'ai'], default: 'crowd' }, // Game type
    singlePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    player2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For 1v1 mode
    crowdId: { type: String, default: 'crowd' },
    crowdName: { type: String, default: 'The Crowd' },
    aiDifficulty: { type: Number, min: 1, max: 6, default: 3 }, // AI minimax depth (1=easy, 6=hard)
    turnDuration: { type: Number, default: 30 }, // Seconds. 0 for infinite.
    // 6 rows, 7 columns. 0=empty, 1=player/player1, 2=crowd/player2/ai
    board: {
        type: [[Number]],
        default: () => Array(6).fill().map(() => Array(7).fill(0))
    },
    currentTurn: { type: String, enum: ['player', 'player2', 'crowd', 'ai'], default: 'player' },
    winner: { type: String, enum: ['player', 'player2', 'crowd', 'ai', 'draw', null], default: null },
    moves: [{
        col: { type: Number, required: true },
        player: { type: String, enum: ['player', 'player2', 'crowd', 'ai'], required: true },
        voteCount: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now }
    }],
    // Community features
    // hearts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // DEPRECATED: Caused unbounded growth. Use Heart collection.
    heartCount: { type: Number, default: 0 }, // Denormalized count for performance
    uniquePlayers: [{ type: String }], // Unique user/crowd IDs who have made moves (for tracking actual plays)
    isPublic: { type: Boolean, default: true }, // Public or private game
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // Persistence for Suspend/Resume (Long-running games)
    savedVotes: { type: Map, of: Number, default: {} }, // Stores { "0": 5, "1": 2 }
    savedTimeLeft: { type: Number, default: null },     // Seconds remaining
    lastActivity: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
