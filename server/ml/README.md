# Human-Trained AI: recorded human moves in Connect Four

This repository is a Connect Four application, not a chess application. Its MongoDB `games` documents store 6×7 boards and column moves; chess positions, Stockfish moves, and chess notation cannot be learned from this database. Human-Trained AI predicts which **Connect Four column** a person might choose. The existing `vs AI` mode remains the minimax opponent.

## Data source and provenance

The deployed model was trained from `latestgames.json`, a local MongoDB Extended JSON export of the application's `games` collection made on September 15, 2026. The export contains MongoDB object IDs and numeric wrappers. Run `node server/ml/train.js latestgames.json` to reproduce training from that snapshot, or pass another export path as the first argument. The game export stays outside the deployment commit; only the learned model artifact and aggregate evaluation report are published. No external or synthetic games are added. The source filename, seed, accepted counts, exclusions, and held-out metrics are recorded in `evaluation.md`.

The `gameMode` and per-move `player` fields identify move origin:

| Game mode | Human training labels | Excluded labels |
| --- | --- | --- |
| `1v1` | `player`, `player2` | None |
| `ai` | `player` | `ai` (minimax) |
| `crowd` | None | `crowd` can be randomly chosen on zero votes or an illegal voted column |
| Missing/other | None | Provenance is ambiguous |

Human moves in `ai` games are still human decisions, although their positions include earlier AI moves. AI moves are replayed to reconstruct those positions but are **never targets, training examples, or augmentation sources**. Games with missing histories, illegal columns, nonalternating labels, moves after a terminal position, or a replayed board that differs from the stored final board are rejected in full. This conservative rule limits accidental training on misattributed moves.

## Position features and model

Each example is the board **before** a human move, its selected column, the side to move, ply, and previous column. The feature vector has a bias term, normalized ply, two 42-cell occupancy planes (own and opponent stones), seven column heights, seven previous-column indicators, and fourteen immediate-win indicators (seven for each side). The win indicators are features observed from the position, not engine scores or engine move labels. Illegal/full columns are masked from the output distribution.

`train.js` optimizes a seven-class softmax classifier with cross-entropy and light L2 regularization. Training examples are mirrored horizontally to share patterns across symmetric positions. Inference samples from the learned legal-move probabilities, so the opponent exhibits varied choices, including choices that minimax would reject. There is no search in the playing model and no adjustable search depth; its difficulty comes from the recorded human decisions.

## Splits and evaluation

An FNV-1a hash of each MongoDB game ID assigns whole games to train (70%), validation (15%), or test (15%). Positions from one game never cross splits. Mirroring occurs only in training. The seed fixes shuffle order; validation cross-entropy chooses the best epoch with early stopping. Test metrics are computed once from that chosen model: top-1 accuracy, top-3 accuracy, cross-entropy, perplexity, top-1 accuracy by game stage, and total variation between actual and predicted opening-column distributions (0 is an exact match). The test report also compares the model's highest-probability move and the actual human move against the existing depth-4 Connect Four minimax player. This minimax comparison is **evaluation only**; its choices are not training labels. Stockfish does not apply to Connect Four. With this data there is no reliable individual skill rating, so Human-Trained AI does not claim to imitate a particular Elo or person.

To refresh the model after collecting more real games, export the `games` collection as Extended JSON and run `node server/ml/train.js /path/to/export.json`. Review the new `evaluation.json` before deploying the model artifact.
