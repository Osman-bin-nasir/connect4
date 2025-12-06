const ROWS = 6;
const COLS = 7;

const checkWin = (board) => {
    // Check horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (board[r][c] > 0 &&
                board[r][c] === board[r][c + 1] &&
                board[r][c] === board[r][c + 2] &&
                board[r][c] === board[r][c + 3]) {
                return board[r][c];
            }
        }
    }

    // Check vertical
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] > 0 &&
                board[r][c] === board[r + 1][c] &&
                board[r][c] === board[r + 2][c] &&
                board[r][c] === board[r + 3][c]) {
                return board[r][c];
            }
        }
    }

    // Check diagonal (down-right)
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (board[r][c] > 0 &&
                board[r][c] === board[r + 1][c + 1] &&
                board[r][c] === board[r + 2][c + 2] &&
                board[r][c] === board[r + 3][c + 3]) {
                return board[r][c];
            }
        }
    }

    // Check diagonal (up-right)
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (board[r][c] > 0 &&
                board[r][c] === board[r - 1][c + 1] &&
                board[r][c] === board[r - 2][c + 2] &&
                board[r][c] === board[r - 3][c + 3]) {
                return board[r][c];
            }
        }
    }

    return null;
};

const checkDraw = (board) => {
    return board.every(row => row.every(cell => cell !== 0));
};

const makeMove = (board, col, player) => {
    // Find the lowest empty row in the column
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            board[r][col] = player;
            return { success: true, row: r };
        }
    }
    return { success: false };
};

module.exports = { checkWin, checkDraw, makeMove };
