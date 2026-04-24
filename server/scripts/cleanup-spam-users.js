require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const Heart = require('../models/Heart');

function parseArgs(argv) {
    const args = {};

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        const next = argv[index + 1];

        if (!current.startsWith('--')) {
            continue;
        }

        const key = current.slice(2);

        if (next && !next.startsWith('--')) {
            args[key] = next;
            index += 1;
            continue;
        }

        args[key] = true;
    }

    return args;
}

function parseList(value) {
    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const prefixes = parseList(args.prefixes);
    const execute = Boolean(args.execute);

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required to run cleanup-spam-users.');
    }

    if (prefixes.length === 0) {
        throw new Error('Provide at least one prefix with --prefixes "kitty,meowmeow,bark".');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const regex = new RegExp(`^(?:${prefixes.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');
    const users = await User.find({ username: regex }).select('_id username').lean();
    const userIds = users.map((user) => user._id);

    const gameIds = await Game.find({
        $or: [
            { singlePlayerId: { $in: userIds } },
            { player2Id: { $in: userIds } }
        ]
    }).distinct('_id');

    const [heartsByUsers, heartsOnSpamGames] = await Promise.all([
        Heart.find({
            user: { $in: userIds },
            game: { $nin: gameIds }
        }).select('_id game').lean(),
        Heart.find({
            game: { $in: gameIds }
        }).select('_id').lean()
    ]);

    const decrementCounts = heartsByUsers.reduce((accumulator, heart) => {
        const gameId = heart.game.toString();
        accumulator.set(gameId, (accumulator.get(gameId) || 0) + 1);
        return accumulator;
    }, new Map());

    const summary = {
        prefixes,
        users: users.length,
        games: gameIds.length,
        heartsByUsers: heartsByUsers.length,
        heartsOnSpamGames: heartsOnSpamGames.length,
        totalHeartsToDelete: heartsByUsers.length + heartsOnSpamGames.length,
        sampleUsers: users.slice(0, 25).map((user) => user.username)
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!execute) {
        console.log('Dry run only. Re-run with --execute to delete these users, their games, and related hearts.');
        return;
    }

    const bulkUpdates = Array.from(decrementCounts.entries()).map(([gameId, count]) => ({
        updateOne: {
            filter: { _id: gameId },
            update: { $inc: { heartCount: -count } }
        }
    }));

    if (bulkUpdates.length > 0) {
        await Game.bulkWrite(bulkUpdates);
        await Game.updateMany(
            { _id: { $in: Array.from(decrementCounts.keys()) }, heartCount: { $lt: 0 } },
            { $set: { heartCount: 0 } }
        );
    }

    const [deletedHearts, deletedGames, deletedUsers] = await Promise.all([
        Heart.deleteMany({
            $or: [
                { user: { $in: userIds } },
                { game: { $in: gameIds } }
            ]
        }),
        Game.deleteMany({ _id: { $in: gameIds } }),
        User.deleteMany({ _id: { $in: userIds } })
    ]);

    console.log(JSON.stringify({
        deletedUsers: deletedUsers.deletedCount,
        deletedGames: deletedGames.deletedCount,
        deletedHearts: deletedHearts.deletedCount
    }, null, 2));
}

main()
    .catch(async (error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close();
    });
