const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const Heart = require('../models/Heart');
const authenticateToken = require('../middleware/auth');

// Create a new game
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { turnDuration, name, isPublic, crowdName, gameMode, aiDifficulty } = req.body;
        const userId = req.user.userId;

        // fallback to 30 only if undefined, allowing 0
        const duration = (turnDuration !== undefined && turnDuration !== null) ? turnDuration : 0;

        const gameData = {
            turnDuration: duration,
            name: name || 'Untitled Game',
            singlePlayerId: userId,
            crowdName: crowdName || 'The Crowd',
            gameMode: gameMode || 'crowd',
            isPublic: isPublic !== undefined ? isPublic : true
        };

        // Set status based on game mode
        if (gameData.gameMode === '1v1') {
            gameData.status = 'waiting'; // Wait for player 2
        } else {
            gameData.status = 'active'; // AI and crowd games start immediately
        }

        // Set AI difficulty if AI mode
        if (gameData.gameMode === 'ai') {
            gameData.aiDifficulty = aiDifficulty || 3;
        }

        const game = new Game(gameData);
        await game.save();
        res.status(201).json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get leaderboard (Hall of Fame) - Public
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await Game.aggregate([
            { $match: { winner: 'player' } },
            {
                $group: {
                    _id: '$singlePlayerId',
                    wins: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 1,
                    username: '$user.username',
                    wins: 1
                }
            },
            { $sort: { wins: -1 } },
            { $limit: 10 }
        ]);

        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get popular games (Most Loved) - Public
router.get('/popular', async (req, res) => {
    try {
        const mostLoved = await Game.find({ isPublic: true, heartCount: { $gt: 0 } })
            .sort({ heartCount: -1 })
            .limit(10)
            .populate('singlePlayerId', 'username');

        // Transform for frontend consistency if needed, but find+populate is usually cleaner than aggregate
        // The original aggregation had a specific project structure. Let's match it roughly or just return the docs.
        // Frontend expects: { _id, name, status, hearts (array len?), heartCount, createdAt, singlePlayerId: { _id, username } }

        // Let's use aggregation to be safe to match exact structure if strictly needed, 
        // OR just mapping. database is cleaner now.
        // Let's stick to aggregation for precise control but simpler now.

        const result = mostLoved.map(g => ({
            _id: g._id,
            name: g.name,
            status: g.status,
            heartCount: g.heartCount, // Direct field
            createdAt: g.createdAt,
            singlePlayerId: g.singlePlayerId
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Heart a game
router.post('/:id/heart', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.id;

        const game = await Game.findById(gameId);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check if already hearted
        const existingHeart = await Heart.findOne({ user: userId, game: gameId });
        if (existingHeart) {
            return res.status(400).json({ error: 'Already hearted this game' });
        }

        // Create Heart
        await Heart.create({ user: userId, game: gameId });

        // Increment count
        game.heartCount = (game.heartCount || 0) + 1;
        await game.save();

        res.json({
            success: true,
            heartCount: game.heartCount
        });
    } catch (err) {
        // Handle race condition duplicate key error
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Already hearted this game' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Unheart a game
router.delete('/:id/heart', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.id;

        const game = await Game.findById(gameId);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        const result = await Heart.findOneAndDelete({ user: userId, game: gameId });

        if (result) {
            // Decrement count
            game.heartCount = Math.max(0, (game.heartCount || 0) - 1);
            await game.save();
        }

        res.json({
            success: true,
            heartCount: game.heartCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get game state - Public
router.get('/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id)
            .populate('singlePlayerId', 'username')
            .populate('player2Id', 'username');
        if (!game) return res.status(404).json({ error: 'Game not found' });

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join game - Protected
router.post('/:id/join', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { role } = req.body; // role: 'player' or 'crowd' or 'player2'
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        if (role === 'player') {
            if (game.singlePlayerId) {
                // Ideally check if it's the SAME player returning
                if (game.singlePlayerId.toString() !== userId) {
                    return res.status(400).json({ error: 'Player already joined' });
                }
            } else {
                game.singlePlayerId = userId;
            }
            game.status = 'active';
            await game.save();
        } else if (role === 'player2') {
            // Join as player 2 in 1v1 mode
            if (game.gameMode !== '1v1') {
                return res.status(400).json({ error: 'This is not a 1v1 game' });
            }
            if (game.player2Id) {
                return res.status(400).json({ error: 'Player 2 already joined' });
            }
            if (game.singlePlayerId.toString() === userId) {
                return res.status(400).json({ error: 'Cannot join your own game as player 2' });
            }

            game.player2Id = userId;
            game.status = 'active';
            await game.save();
        }
        // Crowd doesn't need to strictly "join" the DB model, they just connect via socket

        const populatedGame = await Game.findById(game._id)
            .populate('singlePlayerId', 'username')
            .populate('player2Id', 'username');
        res.json(populatedGame);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all games for a user - Protected (or public if we want to see others' profiles?)
// Let's keep it specific to the user for the dashboard, so we can use the token.
// Actually, the current API was `/user/:userId`. If we want to see our own games on dashboard, we can just use `/my-games` or verify token matches.
// But to minimize frontend changes for now, let's keep the route but ensure security.
// If I am fetching my own games, I should be authorized.
// If I am fetching someone else's games (public profile), it should be fine?
// The dashboard uses it to fetch "My Games".
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        // Enforce that you can only fetch your own games for the dashboard "manage" view
        if (!req.user || !req.user.userId || req.params.userId.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const games = await Game.find({ singlePlayerId: req.params.userId }).sort({ createdAt: -1 });
        res.json(games);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rename game / Update game settings
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, isPublic, crowdName } = req.body;
        const userId = req.user.userId;
        const game = await Game.findById(req.params.id);

        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check ownership
        if (game.singlePlayerId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (name !== undefined) game.name = name;
        if (crowdName !== undefined) game.crowdName = crowdName;
        if (isPublic !== undefined) game.isPublic = isPublic;
        game.updatedAt = Date.now();
        await game.save();

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete game
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const game = await Game.findById(req.params.id);

        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check ownership
        if (game.singlePlayerId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Game.findByIdAndDelete(req.params.id);

        res.json({ message: 'Game deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get head-to-head stats for 1v1 game
router.get('/:id/stats', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        if (game.gameMode !== '1v1' || !game.player2Id) {
            return res.json({ player1Wins: 0, player2Wins: 0 });
        }

        const p1Id = game.singlePlayerId;
        const p2Id = game.player2Id;

        // Count games where P1 (as host or joiner) won against P2
        const p1WinsAsHost = await Game.countDocuments({
            singlePlayerId: p1Id,
            player2Id: p2Id,
            gameMode: '1v1',
            status: 'completed',
            winner: 'player'
        });

        const p1WinsAsJoiner = await Game.countDocuments({
            singlePlayerId: p2Id,
            player2Id: p1Id,
            gameMode: '1v1',
            status: 'completed',
            winner: 'player2'
        });

        // Count games where P2 (as host or joiner) won against P1
        const p2WinsAsJoiner = await Game.countDocuments({
            singlePlayerId: p1Id,
            player2Id: p2Id,
            gameMode: '1v1',
            status: 'completed',
            winner: 'player2'
        });

        const p2WinsAsHost = await Game.countDocuments({
            singlePlayerId: p2Id,
            player2Id: p1Id,
            gameMode: '1v1',
            status: 'completed',
            winner: 'player'
        });

        res.json({
            player1Wins: p1WinsAsHost + p1WinsAsJoiner,
            player2Wins: p2WinsAsHost + p2WinsAsJoiner
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check if hearted - Protected
router.get('/:id/is-hearted', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const exists = await Heart.exists({ user: userId, game: req.params.id });
        res.json({ isHearted: !!exists });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all games hearted by user
router.get('/my-hearts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const hearts = await Heart.find({ user: userId }).select('game');
        const gameIds = hearts.map(h => h.game);
        res.json(gameIds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
