const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const Heart = require('../models/Heart');
const authenticateToken = require('../middleware/auth');
const { isHostPresent } = require('../socket/lobbyPresence');

const OPEN_1V1_LOBBY_MAX_AGE_MS = 5 * 60 * 1000;

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

// Get latest completed public 1v1 and AI games - Public
router.get('/completed/recent', async (req, res) => {
    try {
        const recentCompleted = await Game.find({
            isPublic: true,
            status: 'completed',
            gameMode: { $in: ['1v1', 'ai'] }
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(60)
            .populate('singlePlayerId', 'username');

        const hostEntriesById = new Map();

        recentCompleted.forEach((game) => {
            const hostId = game.singlePlayerId?._id?.toString() || `game:${game._id.toString()}`;
            const existingEntry = hostEntriesById.get(hostId);

            if (!existingEntry) {
                hostEntriesById.set(hostId, {
                    hostId,
                    mostRecent: game,
                    mostRecentNonAi: game.gameMode !== 'ai' ? game : null
                });
                return;
            }

            if (!existingEntry.mostRecentNonAi && game.gameMode !== 'ai') {
                existingEntry.mostRecentNonAi = game;
            }
        });

        const getGameTimestamp = (game) => new Date(game.updatedAt || game.createdAt).getTime();
        const hostEntries = Array.from(hostEntriesById.values()).sort(
            (a, b) => getGameTimestamp(b.mostRecent) - getGameTimestamp(a.mostRecent)
        );

        const MAX_RESULTS = 10;
        const VISIBLE_RESULTS = 4;

        let curatedEntries = hostEntries
            .slice(0, MAX_RESULTS)
            .map((entry) => ({ hostId: entry.hostId, game: entry.mostRecent }));

        const visibleCount = Math.min(VISIBLE_RESULTS, curatedEntries.length);
        const hasVisibleHumanGame = curatedEntries
            .slice(0, visibleCount)
            .some((entry) => entry.game.gameMode !== 'ai');

        if (!hasVisibleHumanGame && visibleCount > 0) {
            const nonAiCandidate = hostEntries
                .filter((entry) => entry.mostRecentNonAi)
                .sort((a, b) => getGameTimestamp(b.mostRecentNonAi) - getGameTimestamp(a.mostRecentNonAi))[0];

            if (nonAiCandidate) {
                const visibleIndex = curatedEntries
                    .slice(0, visibleCount)
                    .findIndex((entry) => entry.hostId === nonAiCandidate.hostId);

                if (visibleIndex >= 0) {
                    curatedEntries[visibleIndex] = {
                        hostId: nonAiCandidate.hostId,
                        game: nonAiCandidate.mostRecentNonAi
                    };
                } else {
                    const promotedVisibleEntries = [
                        ...curatedEntries.slice(0, Math.max(0, visibleCount - 1)),
                        { hostId: nonAiCandidate.hostId, game: nonAiCandidate.mostRecentNonAi }
                    ];
                    const promotedHostIds = new Set(promotedVisibleEntries.map((entry) => entry.hostId));
                    const remainingEntries = hostEntries
                        .filter((entry) => !promotedHostIds.has(entry.hostId))
                        .map((entry) => ({ hostId: entry.hostId, game: entry.mostRecent }));

                    curatedEntries = [...promotedVisibleEntries, ...remainingEntries].slice(0, MAX_RESULTS);
                }
            }
        }

        const result = curatedEntries.map(({ game }) => ({
            _id: game._id,
            name: game.name,
            status: game.status,
            heartCount: game.heartCount,
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
            gameMode: game.gameMode,
            singlePlayerId: game.singlePlayerId
        }));

        res.json(result);
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

// Get open public 1v1 lobbies - Public
router.get('/lobbies/1v1/open', async (req, res) => {
    try {
        const lobbies = await Game.find({
            gameMode: '1v1',
            status: 'waiting',
            isPublic: true,
            createdAt: { $gte: new Date(Date.now() - OPEN_1V1_LOBBY_MAX_AGE_MS) },
            $or: [
                { player2Id: { $exists: false } },
                { player2Id: null }
            ]
        })
            .sort({ createdAt: -1 })
            .select('name createdAt turnDuration status gameMode singlePlayerId')
            .populate('singlePlayerId', 'username')
            .lean();

        const result = lobbies
            .filter((game) => isHostPresent(game._id))
            .slice(0, 24)
            .map((game) => ({
            _id: game._id,
            name: game.name,
            createdAt: game.createdAt,
            turnDuration: game.turnDuration,
            status: game.status,
            gameMode: game.gameMode,
            singlePlayerId: game.singlePlayerId
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
        if (role === 'player2') {
            const existingGame = await Game.findById(req.params.id).select('singlePlayerId player2Id gameMode status');

            if (!existingGame) {
                return res.status(404).json({ error: 'Game not found' });
            }

            if (existingGame.gameMode !== '1v1') {
                return res.status(400).json({ error: 'This is not a 1v1 game' });
            }

            if (existingGame.singlePlayerId.toString() === userId) {
                return res.status(400).json({ error: 'Cannot join your own game as player 2' });
            }

            if (existingGame.player2Id) {
                if (existingGame.player2Id.toString() === userId) {
                    const populatedExistingGame = await Game.findById(existingGame._id)
                        .populate('singlePlayerId', 'username')
                        .populate('player2Id', 'username');
                    return res.json(populatedExistingGame);
                }

                return res.status(409).json({ error: 'This 1v1 lobby is no longer open' });
            }

            const joinedGame = await Game.findOneAndUpdate(
                {
                    _id: req.params.id,
                    gameMode: '1v1',
                    status: 'waiting',
                    $or: [
                        { player2Id: { $exists: false } },
                        { player2Id: null }
                    ]
                },
                {
                    $set: {
                        player2Id: userId,
                        status: 'active',
                        currentTurn: 'player2',
                        updatedAt: Date.now()
                    }
                },
                { new: true }
            )
                .populate('singlePlayerId', 'username')
                .populate('player2Id', 'username');

            if (!joinedGame) {
                return res.status(409).json({ error: 'This 1v1 lobby is no longer open' });
            }

            return res.json(joinedGame);
        }

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
        const games = await Game.find({
            $or: [
                { singlePlayerId: req.params.userId },
                { player2Id: req.params.userId }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('singlePlayerId', 'username')
            .populate('player2Id', 'username');
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

module.exports = router;
