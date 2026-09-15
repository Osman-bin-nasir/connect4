const test = require('node:test');
const assert = require('node:assert/strict');
const { replayGame, emptyBoard, getHumanMove } = require('./humanMoves');

test('AI decisions reconstruct positions but never become training targets', () => {
    const board = emptyBoard();
    board[5][3] = 1;
    board[5][4] = 2;
    board[4][3] = 1;
    const game = { gameMode: 'ai', board, moves: [
        { col: 3, player: 'player' }, { col: 4, player: 'ai' }, { col: 3, player: 'player' }
    ] };
    const examples = replayGame(game);
    assert.equal(examples.length, 2);
    assert.equal(examples[1].board[5][4], 2);
    assert.deepEqual(examples.map(example => example.col), [3, 3]);
});

test('one-on-one replay accepts either first player but rejects an inconsistent final board', () => {
    const board = emptyBoard();
    board[5][4] = 2;
    board[5][3] = 1;
    const game = { gameMode: '1v1', board, moves: [
        { col: 4, player: 'player2' }, { col: 3, player: 'player' }
    ] };
    assert.equal(replayGame(game).length, 2);
    game.board[5][3] = 0;
    assert.equal(replayGame(game), null);
});

test('Rival samples only legal columns', () => {
    const board = emptyBoard();
    for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) board[row][col] = row % 2 + 1;
    for (let i = 0; i < 30; i++) assert.equal(getHumanMove(board, 2), 6);
});
