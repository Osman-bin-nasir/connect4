const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const {
    jwtSecret,
    publicSignupEnabled,
    signupEmailRequired,
    minPasswordLength,
    signupBurstLimit,
    signupDailyLimit
} = require('../config/security');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function createJsonLimiter({ windowMs, max, error }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            console.warn(`[rate-limit] ${req.method} ${req.originalUrl} blocked for ${req.ip}`);
            res.status(429).json({ error });
        }
    });
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        console.warn(`[rate-limit] ${req.method} ${req.originalUrl} blocked for ${req.ip}`);
        res.status(429).json({ error: 'Too many login attempts from this IP. Please wait a bit and try again.' });
    }
});

const signupBurstLimiter = createJsonLimiter({
    windowMs: 15 * 60 * 1000,
    max: signupBurstLimit,
    error: 'Too many signup attempts from this IP. Please try again later.'
});

const signupDailyLimiter = createJsonLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: signupDailyLimit,
    error: 'Signup is temporarily limited from this IP. Please contact support if you need access.'
});

function normalizeUsername(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidUsername(username) {
    return /^[A-Za-z0-9_]{3,24}$/.test(username);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Signup
router.post('/signup', signupBurstLimiter, signupDailyLimiter, async (req, res) => {
    try {
        if (!publicSignupEnabled) {
            return res.status(503).json({
                error: 'Account creation is temporarily paused while we stop signup abuse.'
            });
        }

        const username = normalizeUsername(req.body?.username);
        const email = normalizeEmail(req.body?.email);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (!isValidUsername(username)) {
            return res.status(400).json({
                error: 'Username must be 3-24 characters and use only letters, numbers, or underscores.'
            });
        }

        if (signupEmailRequired && !email) {
            return res.status(400).json({
                error: 'Email is currently required for new signups.'
            });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        // Password policy
        if (password.length < minPasswordLength) {
            return res.status(400).json({
                error: `Password must be at least ${minPasswordLength} characters long`
            });
        }

        // Check if username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken. Please choose another one.' });
        }

        // Check if email already exists (if provided)
        if (email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (omit email if empty to avoid sparse index issues)
        const userData = {
            username,
            password: hashedPassword,
            isGuest: false
        };
        if (email) userData.email = email;

        const user = new User(userData);

        await user.save();
        console.info(`[auth] Created account ${user.username} from ${req.ip}`);

        // Generate token
        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: JWT_EXPIRES_IN });

        // Return user without password
        const userResponse = {
            _id: user._id,
            username: user.username,
            email: user.email,
            isGuest: user.isGuest
        };

        res.status(201).json({ user: userResponse, token });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const normalizedIdentifier = identifier.includes('@') ? identifier.toLowerCase() : identifier;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Username and password are required' });
        }

        // Find user by either email or username
        const user = await User.findOne({
            $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }]
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: JWT_EXPIRES_IN });

        // Return user without password
        const userResponse = {
            _id: user._id,
            username: user.username,
            email: user.email,
            isGuest: user.isGuest
        };

        res.json({ user: userResponse, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
