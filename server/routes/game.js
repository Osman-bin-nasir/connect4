const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');

// Create a new game
router.post('/', async (req, res) => {
    try {
        const { turnDuration, name, userId } = req.body;
        // fallback to 30 only if undefined, allowing 0
        const duration = (turnDuration !== undefined && turnDuration !== null) ? turnDuration : 30;
        const game = new Game({
            turnDuration: duration,
            name: name || 'Untitled Game',
            singlePlayerId: userId || null,
            status: userId ? 'active' : 'waiting'
        });
        await game.save();
        res.status(201).json(game);
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

// Rename game
router.put('/:id', async (req, res) => {
    try {
        const { name, userId } = req.body;
        const game = await Game.findById(req.params.id);

        if (!game) return res.status(404).json({ error: 'Game not found' });

        // Check ownership
        if (game.singlePlayerId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        game.name = name;
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
