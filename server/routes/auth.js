const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Strict Auth Limiter
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 login/signup requests per hour
    message: 'Too many accounts created from this IP, please try again after an hour'
});

// Signup
router.post('/signup', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Password policy
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
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

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

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
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Username and password are required' });
        }

        // Find user by either email or username
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
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
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

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
