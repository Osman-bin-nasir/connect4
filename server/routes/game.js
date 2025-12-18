const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

// Create a new game
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { turnDuration, name, isPublic, crowdName } = req.body;
        const userId = req.user.userId;

        // fallback to 30 only if undefined, allowing 0
        const duration = (turnDuration !== undefined && turnDuration !== null) ? turnDuration : 30;
        const game = new Game({
            turnDuration: duration,
            name: name || 'Untitled Game',
            singlePlayerId: userId,
            crowdName: crowdName || 'The Crowd',
            status: 'active',
            isPublic: isPublic !== undefined ? isPublic : true
        });
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
        const mostLoved = await Game.aggregate([
            { $match: { isPublic: true } },
            {
                $addFields: {
                    heartCount: { $size: { $ifNull: ['$hearts', []] } }
                }
            },
            { $match: { heartCount: { $gt: 0 } } },
            { $sort: { heartCount: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'singlePlayerId',
                    foreignField: '_id',
                    as: 'player'
                }
            },
            { $unwind: { path: '$player', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    status: 1,
                    hearts: 1,
                    heartCount: 1,
                    createdAt: 1,
                    singlePlayerId: {
                        _id: '$player._id',
                        username: '$player.username'
                    }
                }
            }
        ]);

        res.json(mostLoved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Heart a game
router.post('/:id/heart', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check if user already hearted this game
        const hearts = game.hearts || [];
        if (hearts.some(id => id.toString() === userId)) {
            return res.status(400).json({ error: 'Already hearted this game' });
        }

        // Add user to hearts array
        game.hearts = [...hearts, userId];
        await game.save();

        res.json({
            success: true,
            heartCount: game.hearts.length,
            hearts: game.hearts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unheart a game
router.delete('/:id/heart', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Remove user from hearts array
        const hearts = game.hearts || [];
        game.hearts = hearts.filter(id => id.toString() !== userId);
        await game.save();

        res.json({
            success: true,
            heartCount: game.hearts.length,
            hearts: game.hearts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get game state - Public
router.get('/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id).populate('singlePlayerId', 'username');
        if (!game) return res.status(404).json({ error: 'Game not found' });

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join game (as single player) - Protected
router.post('/:id/join', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { role } = req.body; // role: 'player' or 'crowd'
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
        }
        // Crowd doesn't need to strictly "join" the DB model, they just connect via socket

        res.json(game);
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
        if (req.params.userId !== req.user.userId) {
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

module.exports = router;
