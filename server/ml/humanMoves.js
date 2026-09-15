const path = require('path');
const { checkWin, makeMove } = require('../utils/gameLogic');

const ROWS = 6;
const COLS = 7;
const MODEL_PATH = path.join(__dirname, 'humanMoveModel.js');

function number(value) {
    return value && typeof value === 'object' && '$numberInt' in value
        ? Number(value.$numberInt) : Number(value);
}

function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function moveLabels(game) {
    if (game.gameMode === '1v1') return { player: 1, player2: 2 };
    if (game.gameMode === 'ai') return { player: 1, ai: 2 };
    return null; // Crowd moves can be random when nobody votes; legacy games have ambiguous provenance.
}

function replayGame(game) {
    const labels = moveLabels(game);
    if (!labels || !Array.isArray(game.moves) || !game.moves.length) return null;
    const board = emptyBoard();
    const examples = [];
    let lastCol = null;
    let finished = false;
    const first = game.moves[0].player;
    if (game.gameMode === '1v1' && !['player', 'player2'].includes(first)) return null;
    for (const [ply, move] of game.moves.entries()) {
        const col = number(move.col);
        const side = labels[move.player];
        if (finished || !Number.isInteger(col) || col < 0 || col >= COLS || !side || board[0][col]) return null;
        if (game.gameMode === '1v1' && move.player !== (ply % 2
            ? (first === 'player' ? 'player2' : 'player') : first)) return null;
        if (game.gameMode === 'ai' && move.player !== (ply % 2 ? 'ai' : 'player')) return null;
        if (move.player !== 'ai') {
            examples.push({ board: board.map(row => [...row]), side, col, ply, lastCol });
        }
        makeMove(board, col, side);
        finished = Boolean(checkWin(board) || board.every(row => row.every(cell => cell)));
        lastCol = col;
    }
    if (!Array.isArray(game.board) || game.board.length !== ROWS ||
        board.some((row, r) => row.some((cell, c) => cell !== number(game.board[r]?.[c])))) return null;
    return examples;
}

// Features describe the position from the player-to-move's perspective.
function features(board, side, ply, lastCol) {
    const other = 3 - side;
    const out = [1, Math.min(ply, 42) / 42];
    for (const row of board) for (const cell of row) out.push(cell === side ? 1 : 0, cell === other ? 1 : 0);
    for (let col = 0; col < COLS; col++) out.push(board.filter(row => row[col]).length / ROWS);
    for (let col = 0; col < COLS; col++) out.push(lastCol === col ? 1 : 0);
    for (const player of [side, other]) {
        for (let col = 0; col < COLS; col++) {
            if (board[0][col]) { out.push(0); continue; }
            const copy = board.map(row => [...row]);
            makeMove(copy, col, player);
            out.push(checkWin(copy) === player ? 1 : 0);
        }
    }
    return out;
}

function probabilities(model, board, side, ply, lastCol) {
    const x = features(board, side, ply, lastCol);
    const scores = model.weights.map((weights, col) => board[0][col] ? -Infinity :
        weights.reduce((sum, weight, i) => sum + weight * x[i], 0));
    const max = Math.max(...scores);
    const exp = scores.map(score => Math.exp(score - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map(value => value / total);
}

function loadModel() {
    const model = require(MODEL_PATH);
    if (model.version !== 1 || model.weights.length !== COLS ||
        model.weights.some(row => row.length !== features(emptyBoard(), 2, 0, null).length)) {
        throw new Error('Invalid human move model artifact');
    }
    return model;
}

let cachedModel;
function getHumanMove(board, lastCol = null) {
    const legal = Array.from({ length: COLS }, (_, col) => col).filter(col => !board[0][col]);
    if (!legal.length) return null;
    cachedModel ||= loadModel();
    const ply = board.flat().filter(Boolean).length;
    const probs = probabilities(cachedModel, board, 2, ply, lastCol);
    let draw = Math.random();
    for (const col of legal) {
        draw -= probs[col];
        if (draw <= 0) return col;
    }
    return legal.at(-1);
}

module.exports = { MODEL_PATH, replayGame, features, probabilities, getHumanMove, emptyBoard };
