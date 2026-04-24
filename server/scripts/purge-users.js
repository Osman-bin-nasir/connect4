require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function buildQuery(args) {
    const query = {};

    const usernames = parseList(args.username);
    if (usernames.length > 0) {
        query.username = { $in: usernames };
    }

    if (args['username-prefix']) {
        query.username = { $regex: `^${escapeRegex(args['username-prefix'])}` };
    }

    if (args['is-guest'] !== undefined) {
        query.isGuest = String(args['is-guest']).trim().toLowerCase() === 'true';
    }

    if (args['missing-email']) {
        query.$or = [
            { email: { $exists: false } },
            { email: null },
            { email: '' }
        ];
    }

    if (args['created-after'] || args['created-before']) {
        query.createdAt = {};

        if (args['created-after']) {
            query.createdAt.$gte = new Date(args['created-after']);
        }

        if (args['created-before']) {
            query.createdAt.$lte = new Date(args['created-before']);
        }
    }

    return query;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error('MONGO_URI is required to run purge-users.');
    }

    const query = buildQuery(args);
    const execute = Boolean(args.execute);

    if (Object.keys(query).length === 0) {
        throw new Error('Refusing to run without filters. Provide at least one filter such as --username-prefix or --created-after.');
    }

    await mongoose.connect(mongoUri);

    const matches = await User.find(query)
        .sort({ createdAt: -1 })
        .select('_id username email isGuest createdAt')
        .limit(20)
        .lean();

    const total = await User.countDocuments(query);

    console.log(`Matched ${total} users.`);
    if (matches.length > 0) {
        console.table(matches);
    }

    if (!execute) {
        console.log('Dry run only. Re-run with --execute to delete these users.');
        return;
    }

    const result = await User.deleteMany(query);
    console.log(`Deleted ${result.deletedCount} users.`);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close();
    });
