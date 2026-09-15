// Train a supervised, legal-move-masked softmax classifier on recorded human choices.
// Usage: node server/ml/train.js [MongoDB Extended JSON games export]
const fs = require('fs');
const path = require('path');
const { replayGame, features, probabilities, MODEL_PATH } = require('./humanMoves');
const { getBestMove } = require('../utils/aiPlayer');

const source = path.resolve(process.argv[2] || path.join(__dirname, '../../games.json'));
const games = JSON.parse(fs.readFileSync(source, 'utf8'));
const seed = 20260915;
let randomState = seed;
function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
}
function gameId(game) { return game._id?.$oid || String(game._id); }
function mirror(example) {
    return { ...example, board: example.board.map(row => [...row].reverse()),
        col: 6 - example.col, lastCol: example.lastCol === null ? null : 6 - example.lastCol };
}

const buckets = { train: [], validation: [], test: [] };
const counts = { inputGames: games.length, rejectedGames: 0, byMode: {}, splitGames: {} };
for (const game of games) {
    if (game.gameMode !== '1v1' && game.gameMode !== 'ai') continue;
    const examples = replayGame(game);
    if (!examples?.length) { counts.rejectedGames++; continue; }
    // All positions in one game stay in the same split. The split is stable across runs.
    const id = gameId(game);
    let hash = 2166136261;
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const fraction = hash / 4294967296;
    const split = fraction < 0.7 ? 'train' : fraction < 0.85 ? 'validation' : 'test';
    buckets[split].push(...examples);
    counts.splitGames[split] = (counts.splitGames[split] || 0) + 1;
    counts.byMode[game.gameMode] ||= { games: 0, humanMoves: 0 };
    counts.byMode[game.gameMode].games++;
    counts.byMode[game.gameMode].humanMoves += examples.length;
}
if (!buckets.train.length || !buckets.validation.length || !buckets.test.length) {
    throw new Error('Insufficient verified games for all three splits');
}

const dimension = features(buckets.train[0].board, buckets.train[0].side, buckets.train[0].ply, buckets.train[0].lastCol).length;
const model = { version: 1, seed, source: path.basename(source), weights: Array.from({ length: 7 }, () => Array(dimension).fill(0)) };
let bestWeights;
let bestLoss = Infinity;
let stale = 0;
for (let epoch = 0; epoch < 45; epoch++) {
    const training = buckets.train.flatMap(example => [example, mirror(example)]);
    for (let i = training.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [training[i], training[j]] = [training[j], training[i]];
    }
    const learningRate = 0.025 / (1 + epoch * 0.15);
    for (const example of training) {
        const x = features(example.board, example.side, example.ply, example.lastCol);
        const probs = probabilities(model, example.board, example.side, example.ply, example.lastCol);
        for (let col = 0; col < 7; col++) {
            if (example.board[0][col]) continue;
            const error = (col === example.col ? 1 : 0) - probs[col];
            for (let k = 0; k < dimension; k++) {
                model.weights[col][k] += learningRate * (error * x[k] - 0.0005 * model.weights[col][k]);
            }
        }
    }
    const loss = evaluate(buckets.validation, false).crossEntropy;
    if (loss < bestLoss - 0.0001) {
        bestLoss = loss;
        bestWeights = model.weights.map(row => [...row]);
        stale = 0;
    } else if (++stale >= 5) break;
}
model.weights = bestWeights;

function evaluate(examples, compareEngine) {
    let top1 = 0, top3 = 0, loss = 0, engineAgreement = 0, humanEngineAgreement = 0;
    const byPly = { opening: [0, 0], middle: [0, 0], late: [0, 0] };
    const openingHuman = Array(7).fill(0), openingModel = Array(7).fill(0);
    let openingCount = 0;
    for (const example of examples) {
        const probs = probabilities(model, example.board, example.side, example.ply, example.lastCol);
        const ranked = [...probs.keys()].sort((a, b) => probs[b] - probs[a]);
        top1 += ranked[0] === example.col;
        top3 += ranked.slice(0, 3).includes(example.col);
        loss -= Math.log(Math.max(probs[example.col], 1e-12));
        const stage = example.ply < 8 ? 'opening' : example.ply < 22 ? 'middle' : 'late';
        byPly[stage][0] += ranked[0] === example.col;
        byPly[stage][1]++;
        if (stage === 'opening') {
            openingHuman[example.col]++;
            for (let col = 0; col < 7; col++) openingModel[col] += probs[col];
            openingCount++;
        }
        if (compareEngine) {
            // Internal Connect Four minimax is an evaluation baseline only, never a label.
            const engineBoard = example.board.map(row => row.map(cell => cell === example.side ? 2 : cell === 0 ? 0 : 1));
            const engineCol = getBestMove(engineBoard, 4);
            engineAgreement += ranked[0] === engineCol;
            humanEngineAgreement += example.col === engineCol;
        }
    }
    const n = examples.length;
    const openingTotalVariation = openingCount ? openingHuman.reduce((sum, count, col) =>
        sum + Math.abs(count / openingCount - openingModel[col] / openingCount), 0) / 2 : null;
    return { positions: n, top1: top1 / n, top3: top3 / n, crossEntropy: loss / n,
        perplexity: Math.exp(loss / n), modelMinimaxAgreement: compareEngine ? engineAgreement / n : undefined,
        humanMinimaxAgreement: compareEngine ? humanEngineAgreement / n : undefined,
        openingDistributionTotalVariation: openingTotalVariation,
        top1ByStage: Object.fromEntries(Object.entries(byPly).map(([stage, [correct, total]]) => [stage, total ? correct / total : null])) };
}

const nativeRandom = Math.random;
Math.random = random; // Minimax breaks tied scores randomly; keep its evaluation comparison repeatable.
const report = { seed, source: path.basename(source), counts: { ...counts,
    splitPositions: Object.fromEntries(Object.entries(buckets).map(([split, examples]) => [split, examples.length])) },
    validation: evaluate(buckets.validation, false), test: evaluate(buckets.test, true) };
Math.random = nativeRandom;
fs.writeFileSync(MODEL_PATH, 'module.exports = ' + JSON.stringify(model) + ';\n');
const percent = value => (value * 100).toFixed(1) + '%';
const markdown = [
    '# Human move prediction evaluation',
    '',
    `Source export: ${report.source}. Seed: ${seed}.`,
    '',
    '| Data | Games | Human moves |',
    '| --- | ---: | ---: |',
    `| Human vs classic AI | ${counts.byMode.ai?.games || 0} | ${counts.byMode.ai?.humanMoves || 0} |`,
    `| Human vs human | ${counts.byMode['1v1']?.games || 0} | ${counts.byMode['1v1']?.humanMoves || 0} |`,
    `| Rejected histories | ${counts.rejectedGames} | — |`,
    '',
    '| Split | Positions | Top-1 | Top-3 | Cross-entropy | Perplexity |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| Validation | ${report.validation.positions} | ${percent(report.validation.top1)} | ${percent(report.validation.top3)} | ${report.validation.crossEntropy.toFixed(3)} | ${report.validation.perplexity.toFixed(2)} |`,
    `| Test | ${report.test.positions} | ${percent(report.test.top1)} | ${percent(report.test.top3)} | ${report.test.crossEntropy.toFixed(3)} | ${report.test.perplexity.toFixed(2)} |`,
    '',
    `Test opening-column distribution total variation: ${report.test.openingDistributionTotalVariation.toFixed(3)} (0 is an exact match).`,
    `Test top-1 agreement with depth-4 minimax: ${percent(report.test.modelMinimaxAgreement)}; actual human agreement with minimax: ${percent(report.test.humanMinimaxAgreement)}.`,
    '',
    'Minimax is an evaluation baseline only. No AI move is a training label.',
    ''
].join('\n');
fs.writeFileSync(path.join(__dirname, 'evaluation.md'), markdown);
console.log(JSON.stringify(report, null, 2));
