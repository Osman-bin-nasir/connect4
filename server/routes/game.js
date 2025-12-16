const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');

// Create a new game
router.post('/', async (req, res) => {
    try {
        const { turnDuration, name, userId, isPublic } = req.body;
        // fallback to 30 only if undefined, allowing 0
        const duration = (turnDuration !== undefined && turnDuration !== null) ? turnDuration : 30;
        const game = new Game({
            turnDuration: duration,
            name: name || 'Untitled Game',
            singlePlayerId: userId || null,
            status: userId ? 'active' : 'waiting',
            isPublic: isPublic !== undefined ? isPublic : true
        });
        await game.save();
        res.status(201).json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get leaderboard (Hall of Fame)
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

// Get popular games (Most Loved / Most Played)
router.get('/popular', async (req, res) => {
    try {
        const { type = 'both' } = req.query;

        const result = {};

        // Get most loved games (by hearts count)
        if (type === 'loved' || type === 'both') {
            const mostLoved = await Game.aggregate([
                { $match: { isPublic: true } },
                {
                    $addFields: {
                        heartCount: { $size: { $ifNull: ['$hearts', []] } },
                        playerCount: { $size: { $ifNull: ['$uniquePlayers', []] } }
                    }
                },
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
                        playerCount: 1,
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

            result.mostLoved = mostLoved;
        }

        // Get most played games (by unique players count)
        if (type === 'played' || type === 'both') {
            const mostPlayed = await Game.aggregate([
                { $match: { isPublic: true } },
                {
                    $addFields: {
                        heartCount: { $size: { $ifNull: ['$hearts', []] } },
                        playerCount: { $size: { $ifNull: ['$uniquePlayers', []] } }
                    }
                },
                { $sort: { playerCount: -1 } },
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
                        playerCount: 1,
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

            result.mostPlayed = mostPlayed;
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Heart a game
router.post('/:id/heart', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
router.delete('/:id/heart', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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

// Get game state
router.get('/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id).populate('singlePlayerId', 'username');
        if (!game) return res.status(404).json({ error: 'Game not found' });

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join game (as single player)
router.post('/:id/join', async (req, res) => {
    const { userId, role } = req.body; // role: 'player' or 'crowd'
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });

        if (role === 'player') {
            if (game.singlePlayerId) {
                return res.status(400).json({ error: 'Player already joined' });
            }
            game.singlePlayerId = userId;
            game.status = 'active';
            await game.save();
        }
        // Crowd doesn't need to strictly "join" the DB model, they just connect via socket

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all games for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const games = await Game.find({ singlePlayerId: req.params.userId }).sort({ createdAt: -1 });
        res.json(games);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rename game / Update game settings
router.put('/:id', async (req, res) => {
    try {
        const { name, userId, isPublic } = req.body;
        const game = await Game.findById(req.params.id);

        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check ownership
        if (game.singlePlayerId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (name !== undefined) game.name = name;
        if (isPublic !== undefined) game.isPublic = isPublic;
        game.updatedAt = Date.now();
        await game.save();

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete game
router.delete('/:id', async (req, res) => {
    try {
        const { userId } = req.body;
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
