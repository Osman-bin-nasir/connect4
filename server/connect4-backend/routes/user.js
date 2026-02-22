const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/guest', async (req, res) => {
    try {
        const user = new User({
            username: `Guest_${Math.floor(Math.random() * 10000)}`,
            isGuest: true
        });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
