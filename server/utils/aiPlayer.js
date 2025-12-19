const { checkWin, checkDraw, makeMove: makeGameMove } = require('./gameLogic');

const ROWS = 6;
const COLS = 7;

/**
 * Get the best move for AI using minimax algorithm with alpha-beta pruning
 * @param {number[][]} board - Game board state
 * @param {number} difficulty - Search depth (1-6, higher is harder)
 * @returns {number} - Column index (0-6) for best move
 */
function getBestMove(board, difficulty = 3) {
    const depth = Math.min(6, Math.max(1, difficulty)); // Clamp between 1-6

    // Get all valid moves
    const validMoves = [];
    for (let col = 0; col < COLS; col++) {
        if (board[0][col] === 0) {
            validMoves.push(col);
        }
    }

    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) return validMoves[0];

    // Evaluate each move
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const col of validMoves) {
        const boardCopy = board.map(row => [...row]);
        makeGameMove(boardCopy, col, 2); // 2 = AI

        // Use minimax to evaluate this move
        const score = minimax(boardCopy, depth - 1, -Infinity, Infinity, false);

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [col];
        } else if (score === bestScore) {
            bestMoves.push(col);
        }
    }

    // Return random move from best moves (adds variety)
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Minimax algorithm with alpha-beta pruning
 * @param {number[][]} board - Current board state
 * @param {number} depth - Remaining search depth
 * @param {number} alpha - Alpha value for pruning
 * @param {number} beta - Beta value for pruning
 * @param {boolean} isMaximizing - Whether it's AI's turn (maximizing)
 * @returns {number} - Board evaluation score
 */
function minimax(board, depth, alpha, beta, isMaximizing) {
    // Check terminal states
    const winner = checkWin(board);
    if (winner === 2) return 10000; // AI wins
    if (winner === 1) return -10000; // Player wins
    if (checkDraw(board)) return 0; // Draw

    // Depth limit reached, evaluate position
    if (depth === 0) {
        return evaluateBoard(board);
    }

    // Get valid moves
    const validMoves = [];
    for (let col = 0; col < COLS; col++) {
        if (board[0][col] === 0) {
            validMoves.push(col);
        }
    }

    if (validMoves.length === 0) return 0;

    if (isMaximizing) {
        // AI's turn - maximize score
        let maxScore = -Infinity;
        for (const col of validMoves) {
            const boardCopy = board.map(row => [...row]);
            makeGameMove(boardCopy, col, 2); // AI move
            const score = minimax(boardCopy, depth - 1, alpha, beta, false);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Beta cutoff
        }
        return maxScore;
    } else {
        // Player's turn - minimize score
        let minScore = Infinity;
        for (const col of validMoves) {
            const boardCopy = board.map(row => [...row]);
            makeGameMove(boardCopy, col, 1); // Player move
            const score = minimax(boardCopy, depth - 1, alpha, beta, true);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Alpha cutoff
        }
        return minScore;
    }
}

/**
 * Evaluate board position heuristically
 * Positive score favors AI, negative favors player
 */
function evaluateBoard(board) {
    let score = 0;

    // Center column preference (strategic advantage)
    const centerCol = 3;
    for (let row = 0; row < ROWS; row++) {
        if (board[row][centerCol] === 2) score += 3;
        if (board[row][centerCol] === 1) score -= 3;
    }

    // Evaluate all possible 4-in-a-row windows
    // Horizontal
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([
                board[row][col],
                board[row][col + 1],
                board[row][col + 2],
                board[row][col + 3]
            ]);
        }
    }

    // Vertical
    for (let row = 0; row < ROWS - 3; row++) {
        for (let col = 0; col < COLS; col++) {
            score += evaluateWindow([
                board[row][col],
                board[row + 1][col],
                board[row + 2][col],
                board[row + 3][col]
            ]);
        }
    }

    // Diagonal (down-right)
    for (let row = 0; row < ROWS - 3; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([
                board[row][col],
                board[row + 1][col + 1],
                board[row + 2][col + 2],
                board[row + 3][col + 3]
            ]);
        }
    }

    // Diagonal (up-right)
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([
                board[row][col],
                board[row - 1][col + 1],
                board[row - 2][col + 2],
                board[row - 3][col + 3]
            ]);
        }
    }

    return score;
}

/**
 * Evaluate a 4-cell window
 * @param {number[]} window - Array of 4 cells
 * @returns {number} - Score for this window
 */
function evaluateWindow(window) {
    let score = 0;
    const aiCount = window.filter(cell => cell === 2).length;
    const playerCount = window.filter(cell => cell === 1).length;
    const emptyCount = window.filter(cell => cell === 0).length;

    // AI scoring
    if (aiCount === 4) score += 100; // Four in a row
    else if (aiCount === 3 && emptyCount === 1) score += 5; // Three with potential
    else if (aiCount === 2 && emptyCount === 2) score += 2; // Two with potential

    // Player blocking (negative score)
    if (playerCount === 3 && emptyCount === 1) score -= 4; // Block player's winning move

    return score;
}

module.exports = { getBestMove, minimax, evaluateBoard };
