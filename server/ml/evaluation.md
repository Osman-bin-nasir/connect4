# Human move prediction evaluation

Source export: latestgames.json. Seed: 20260915.

| Data | Games | Human moves |
| --- | ---: | ---: |
| Human vs classic AI | 1257 | 11160 |
| Human vs human | 97 | 1803 |
| Rejected histories | 238 | — |

| Split | Positions | Top-1 | Top-3 | Cross-entropy | Perplexity |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 2105 | 37.7% | 75.7% | 1.567 | 4.79 |
| Test | 2013 | 37.1% | 75.0% | 1.558 | 4.75 |

Test opening-column distribution total variation: 0.027 (0 is an exact match).
Test top-1 agreement with depth-4 minimax: 43.7%; actual human agreement with minimax: 34.4%.

Minimax is an evaluation baseline only. No AI move is a training label.
