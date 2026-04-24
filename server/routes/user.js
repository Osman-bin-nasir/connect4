const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { guestAccountsEnabled } = require('../config/security');

const guestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[rate-limit] ${req.method} ${req.originalUrl} blocked for ${req.ip}`);
        res.status(429).json({ error: 'Too many guest account requests from this IP. Please try again later.' });
    }
});

router.post('/guest', guestLimiter, async (req, res) => {
    try {
        if (!guestAccountsEnabled) {
            return res.status(503).json({
                error: 'Guest accounts are temporarily disabled while we stop automated account creation.'
            });
        }

        const user = new User({
            username: `Guest_${crypto.randomInt(100000, 999999)}`,
            isGuest: true
        });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
