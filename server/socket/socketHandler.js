const Game = require('../models/Game');
const { checkWin, checkDraw, makeMove } = require('../utils/gameLogic');

// In-memory storage
const gameVotes = {}; // { gameId: { col0: 5, col1: 2 } }
const gameTimers = {}; // { gameId: intervalId }
const gameTimeLeft = {}; // { gameId: seconds } - track current time for sync
const gameVoters = {}; // { gameId: Set([socketId1, socketId2, ...]) } - track who voted this turn

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join_game', async ({ gameId, role }) => {
            socket.join(gameId);
            console.log(`User ${socket.id} joined game ${gameId} as ${role}`);

            const game = await Game.findById(gameId).populate('singlePlayerId', 'username');
            if (game) {
                socket.emit('game_state', game);
                // If crowd turn, send current timer/votes?
                if (game.currentTurn === 'crowd') {
                    // Sync votes
                    if (gameVotes[gameId]) {
                        const count = gameVoters[gameId] ? gameVoters[gameId].size : 0;
                        socket.emit('vote_update', {
                            votes: gameVotes[gameId],
                            voterCount: count
                        });
                    }

                    // Sync timer
                    if (game.turnDuration === 0) {
                        socket.emit('timer_sync', 'infinite');
                    } else if (gameTimeLeft[gameId] !== undefined) {
                        socket.emit('timer_sync', gameTimeLeft[gameId]);
                    }
                }
            }
        });

        socket.on('make_move', async ({ gameId, col, userId }) => {
            try {
                const game = await Game.findById(gameId).populate('singlePlayerId', 'username');
                if (!game || game.status !== 'active' || game.currentTurn !== 'player') return;

                // Verify user is the single player (optional security check)
                // if (game.singlePlayerId.toString() !== userId) return;

                const { success } = makeMove(game.board, col, 1); // 1 = player
                if (success) {
                    // Record the move for replay
                    game.moves.push({ col, player: 'player', timestamp: new Date() });

                    const winner = checkWin(game.board);
                    if (winner) {
                        game.winner = 'player';
                        game.status = 'completed';
                    } else if (checkDraw(game.board)) {
                        game.winner = 'draw';
                        game.status = 'completed';
                    } else {
                        game.currentTurn = 'crowd';
                        startCrowdTimer(io, gameId);
                    }
                    game.markModified('board');
                    await game.save();
                    io.to(gameId).emit('game_state', game);
                }
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('cast_vote', ({ gameId, col, crowdUserId }) => {
            const voterId = crowdUserId || socket.id; // Fallback to socket.id if not provided

            // Initialize vote tracking structures if needed
            if (!gameVotes[gameId]) gameVotes[gameId] = {};
            if (!gameVoters[gameId]) gameVoters[gameId] = new Set();

            // Check if this user has already voted this turn
            if (gameVoters[gameId].has(voterId)) {
                return;
            }

            // Initialize vote counts if needed
            for (let i = 0; i < 7; i++) {
                if (!gameVotes[gameId][i]) gameVotes[gameId][i] = 0;
            }

            // Record vote and mark user as voted
            gameVotes[gameId][col]++;
            gameVoters[gameId].add(voterId);

            io.to(gameId).emit('vote_update', {
                votes: gameVotes[gameId],
                voterCount: gameVoters[gameId].size
            });
        });

        socket.on('force_crowd_move', async ({ gameId, userId }) => {
            try {
                const game = await Game.findById(gameId);
                // Security: only the single player can force move
                if (!game || game.singlePlayerId.toString() !== userId) return;

                // Only if it's currently crowd's turn (and maybe strictly if infinite time, but generally safe to allow 'finalize now')
                if (game.currentTurn === 'crowd') {
                    if (gameTimers[gameId]) {
                        clearInterval(gameTimers[gameId]);
                        delete gameTimers[gameId];
                        delete gameTimeLeft[gameId];
                    }
                    resolveCrowdTurn(io, gameId);
                }
            } catch (err) {
                console.error("Force move error", err);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};

async function startCrowdTimer(io, gameId) {
    if (gameTimers[gameId]) clearInterval(gameTimers[gameId]);

    const game = await Game.findById(gameId);
    if (!game) return;

    let timeLeft = game.turnDuration; // Use game configured duration

    // Reset votes and voters for new turn
    gameVotes[gameId] = {};
    gameVoters[gameId] = new Set(); // Clear voter tracking
    for (let i = 0; i < 7; i++) gameVotes[gameId][i] = 0;
    io.to(gameId).emit('vote_update', { votes: gameVotes[gameId], voterCount: 0 });

    // specific check for infinite time
    if (timeLeft === 0) {
        io.to(gameId).emit('timer_sync', 'infinite'); // or 0 or null, string might be clearer for client
        return;
    }

    io.to(gameId).emit('timer_sync', timeLeft);
    gameTimeLeft[gameId] = timeLeft;

    const interval = setInterval(() => {
        timeLeft--;
        gameTimeLeft[gameId] = timeLeft;
        io.to(gameId).emit('timer_sync', timeLeft);
        if (timeLeft <= 0) {
            clearInterval(interval);
            delete gameTimers[gameId];
            delete gameTimeLeft[gameId];
            resolveCrowdTurn(io, gameId);
        }
    }, 1000);

    gameTimers[gameId] = interval;
}

async function resolveCrowdTurn(io, gameId) {
    try {
        const game = await Game.findById(gameId).populate('singlePlayerId', 'username');
        if (!game || game.status !== 'completed' && game.currentTurn !== 'crowd') {
            // Safety check
        }
        if (!game) return;

        const votes = gameVotes[gameId] || {};
        let maxVotes = -1;
        let candidates = [];

        // Find columns with max votes
        for (let col = 0; col < 7; col++) {
            const count = votes[col] || 0;
            if (count > maxVotes) {
                maxVotes = count;
                candidates = [col];
            } else if (count === maxVotes) {
                candidates.push(col);
            }
        }

        // If no votes or all 0, candidates will be all columns (if initialized) or empty
        // If empty candidates (shouldn't happen if initialized), pick random
        if (candidates.length === 0) candidates = [0, 1, 2, 3, 4, 5, 6];

        // Pick random from candidates
        let selectedCol = candidates[Math.floor(Math.random() * candidates.length)];

        // Attempt move. If column full, try another random column
        let moveResult = makeMove(game.board, selectedCol, 2); // 2 = crowd

        // If full, try others
        if (!moveResult.success) {
            const availableCols = [];
            for (let c = 0; c < 7; c++) {
                if (game.board[0][c] === 0) availableCols.push(c);
            }
            if (availableCols.length > 0) {
                selectedCol = availableCols[Math.floor(Math.random() * availableCols.length)];
                moveResult = makeMove(game.board, selectedCol, 2);
            } else {
                // Board full? Should be caught by checkDraw
            }
        }

        if (moveResult.success) {
            // Record the move for replay
            game.moves.push({ col: selectedCol, player: 'crowd', timestamp: new Date() });

            const winner = checkWin(game.board);
            if (winner) {
                game.winner = 'crowd';
                game.status = 'completed';
            } else if (checkDraw(game.board)) {
                game.winner = 'draw';
                game.status = 'completed';
            } else {
                game.currentTurn = 'player';
            }
            game.markModified('board');
            await game.save();
            io.to(gameId).emit('game_state', game);
            io.to(gameId).emit('last_crowd_move', { col: selectedCol });
        }

        // Clear voters after turn completes
        if (gameVoters[gameId]) {
            delete gameVoters[gameId];
        }
    } catch (err) {
        console.error("Error resolving crowd turn:", err);
    }
}
