const Game = require('../models/Game');
const { checkWin, checkDraw, makeMove } = require('../utils/gameLogic');
const { getBestMove } = require('../utils/aiPlayer');

// In-memory storage
const gameVotes = {}; // { gameId: { col0: 5, col1: 2 } }
const gameTimers = {}; // { gameId: intervalId }
const gameTimeLeft = {}; // { gameId: seconds } - track current time for sync
const gameVoters = {}; // { gameId: Set([socketId1, socketId2, ...]) } - track who voted this turn
const rematchRequests = {}; // { gameId: Set(userIds) }


const jwt = require('jsonwebtoken');

module.exports = (io) => {

    // Middleware for socket auth
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', (err, decoded) => {
                if (err) return next(new Error('Authentication error'));
                socket.user = decoded;
                next();
            });
        } else {
            // Allow anonymous connection for Crowd
            socket.user = null;
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id, socket.user ? `(Auth: ${socket.user.userId})` : '(Guest)');

        socket.on('join_game', async ({ gameId, role }) => {
            socket.join(gameId);
            console.log(`User ${socket.id} joined game ${gameId} as ${role}`);

            const game = await Game.findById(gameId)
                .populate('singlePlayerId', 'username')
                .populate('player2Id', 'username');
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

        socket.on('make_move', async ({ gameId, col }) => {
            // Security: Only authenticated users can make moves
            if (!socket.user) return;

            try {
                const game = await Game.findById(gameId)
                    .populate('singlePlayerId', 'username')
                    .populate('player2Id', 'username');
                if (!game || game.status !== 'active') return;

                // Determine which player is making the move
                let playerValue, playerLabel, nextTurn;

                if (game.gameMode === 'crowd') {
                    // Original crowd mode logic
                    if (game.currentTurn !== 'player') return;
                    if (game.singlePlayerId._id.toString() !== socket.user.userId) return;

                    playerValue = 1;
                    playerLabel = 'player';
                    nextTurn = 'crowd';
                } else if (game.gameMode === '1v1') {
                    // 1v1 mode logic
                    const isPlayer1 = game.singlePlayerId._id.toString() === socket.user.userId;
                    const isPlayer2 = game.player2Id && game.player2Id._id.toString() === socket.user.userId;

                    if (game.currentTurn === 'player' && isPlayer1) {
                        playerValue = 1;
                        playerLabel = 'player';
                        nextTurn = 'player2';
                    } else if (game.currentTurn === 'player2' && isPlayer2) {
                        playerValue = 2;
                        playerLabel = 'player2';
                        nextTurn = 'player';
                    } else {
                        return; // Not this player's turn
                    }
                } else if (game.gameMode === 'ai') {
                    // AI mode logic
                    if (game.currentTurn !== 'player') return;
                    if (game.singlePlayerId._id.toString() !== socket.user.userId) return;

                    playerValue = 1;
                    playerLabel = 'player';
                    nextTurn = 'ai';
                } else {
                    return;
                }

                const { success } = makeMove(game.board, col, playerValue);
                if (success) {
                    // Record the move for replay
                    game.moves.push({ col, player: playerLabel, timestamp: new Date() });

                    // Track unique player
                    if (socket.user.userId && !game.uniquePlayers.includes(socket.user.userId)) {
                        game.uniquePlayers.push(socket.user.userId);
                    }

                    const winner = checkWin(game.board);
                    if (winner) {
                        game.winner = playerLabel;
                        game.status = 'completed';
                    } else if (checkDraw(game.board)) {
                        game.winner = 'draw';
                        game.status = 'completed';
                    } else {
                        game.currentTurn = nextTurn;

                        // Start crowd timer if next turn is crowd
                        if (nextTurn === 'crowd') {
                            startCrowdTimer(io, gameId);
                        }
                    }
                    game.markModified('board');
                    const savedGame = await game.save();
                    io.to(gameId).emit('game_state', savedGame);

                    // Trigger AI move if AI's turn
                    if (game.gameMode === 'ai' && nextTurn === 'ai' && game.status === 'active') {
                        handleAIMove(io, gameId);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('cast_vote', async ({ gameId, col, crowdUserId }) => {
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
            console.log(`Vote cast in ${gameId} for col ${col}. Total: ${gameVotes[gameId][col]}`);
            gameVoters[gameId].add(voterId);

            // Track unique crowd player (only on first vote ever, not per turn)
            try {
                const game = await Game.findById(gameId);
                if (game && crowdUserId && !game.uniquePlayers.includes(crowdUserId)) {
                    game.uniquePlayers.push(crowdUserId);
                    await game.save();
                }
            } catch (err) {
                console.error('Error tracking unique crowd player:', err);
            }

            io.to(gameId).emit('vote_update', {
                votes: gameVotes[gameId],
                voterCount: gameVoters[gameId].size
            });
        });

        socket.on('force_crowd_move', async ({ gameId }) => {
            // Security limit
            if (!socket.user) return;

            try {
                const game = await Game.findById(gameId);
                // Security: only the single player can force move
                if (!game || game.singlePlayerId.toString() !== socket.user.userId) return;

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

        // Rematch Logic for 1v1
        socket.on('request_rematch', async (data) => {
            if (!socket.user) return; // Auth required
            if (!data || !data.gameId) {
                console.error('Invalid rematch request payload:', data);
                return;
            }

            const { gameId } = data;

            try {
                const game = await Game.findById(gameId);
                // Validation: Must be 1v1, completed, and user must be one of the players
                if (!game) {
                    console.log('Rematch requested for non-existent game:', gameId);
                    return;
                }
                if (game.gameMode !== '1v1' || game.status !== 'completed') {
                    console.log('Invalid rematch state:', game.gameMode, game.status);
                    return;
                }

                const userId = socket.user.userId;
                // Safely convert ObjectIds to strings
                const p1Id = game.singlePlayerId ? game.singlePlayerId.toString() : null;
                const p2Id = game.player2Id ? game.player2Id.toString() : null;

                if (userId !== p1Id && userId !== p2Id) {
                    console.log('Rematch requested by non-participant:', userId);
                    return;
                }

                // Init rematch tracking
                if (!rematchRequests[gameId]) rematchRequests[gameId] = new Set();

                rematchRequests[gameId].add(userId);

                // Check if both agreed
                const requests = rematchRequests[gameId];

                console.log(`Rematch requested for ${gameId} by ${userId}. Total requests: ${requests.size}`);

                // Emit update to show who accepted
                io.to(gameId).emit('rematch_update', {
                    requestedBy: Array.from(requests)
                });

                if (requests.size >= 2) {
                    console.log(`Both players agreed to rematch in ${gameId}. Starting new game...`);
                    // Start new game!
                    // Create new game with same settings
                    // However, to keep "host" consistent, let's keep spId as p1.

                    const newGame = new Game({
                        name: game.name,
                        status: 'active', // 1v1 starts active if we pre-fill p2
                        gameMode: '1v1',
                        singlePlayerId: game.singlePlayerId,
                        player2Id: game.player2Id,
                        isPublic: game.isPublic,
                        turnDuration: game.turnDuration
                    });

                    await newGame.save();

                    // Notify clients to switch
                    io.to(gameId).emit('game_reset', { newGameId: newGame._id });

                    // Cleanup
                    delete rematchRequests[gameId];
                }

            } catch (err) {
                console.error('Error in request_rematch:', err);
            }
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
        console.log(`Resolving turn for ${gameId}. Votes:`, JSON.stringify(votes));

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
            const moveVoteCount = (votes[selectedCol] || 0); // Get actual votes for this col
            game.moves.push({
                col: selectedCol,
                player: 'crowd',
                voteCount: moveVoteCount,
                timestamp: new Date()
            });

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
            const savedGame = await game.save();
            io.to(gameId).emit('game_state', savedGame);
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

// Handle AI move with slight delay for better UX
async function handleAIMove(io, gameId) {
    try {
        // Slight delay so player sees their move first
        await new Promise(resolve => setTimeout(resolve, 500));

        const game = await Game.findById(gameId).populate('singlePlayerId', 'username');
        if (!game || game.status !== 'active' || game.currentTurn !== 'ai') return;

        // Get AI's best move
        const aiCol = getBestMove(game.board, game.aiDifficulty);

        if (aiCol === null) return; // No valid moves

        const { success } = makeMove(game.board, aiCol, 2); // 2 = AI
        if (success) {
            // Record the move
            game.moves.push({ col: aiCol, player: 'ai', timestamp: new Date() });

            const winner = checkWin(game.board);
            if (winner) {
                game.winner = 'ai';
                game.status = 'completed';
            } else if (checkDraw(game.board)) {
                game.winner = 'draw';
                game.status = 'completed';
            } else {
                game.currentTurn = 'player';
            }

            game.markModified('board');
            const savedGame = await game.save();
            io.to(gameId).emit('game_state', savedGame);
        }
    } catch (err) {
        console.error('AI move error:', err);
    }
}
