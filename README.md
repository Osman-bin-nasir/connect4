# Jack vs The Subreddit — Connect 4

A browser-based Connect Four game built around one question: can Jack beat the subreddit? Players can practice against friends or computer opponents while the community challenge takes shape.

[Play the game](https://connect4.jacksucksatlife.com)

## Ways to play

- **1 vs The Crowd:** one player faces a crowd that votes on each move.
- **1 vs 1:** play another person in a public or private match.
- **vs AI:** face a computer opponent with adjustable difficulty.
- **vs Human-Trained AI:** play an AI trained on moves from real players' games.

Games update live. You can share match links, set turn timers, replay moves, heart public games, and view the leaderboard.

## Run locally

The app has a React/Vite frontend in `client/` and a Node.js, Socket.IO, and MongoDB backend in `server/`.

1. In `server/`, install dependencies with `npm install`, set `MONGO_URI` and `JWT_SECRET` in `.env`, then run `npm run dev`.
2. In `client/`, install dependencies with `npm install`, set `VITE_API_URL` to the backend URL if it is not on `http://localhost:3001`, then run `npm run dev`.

The Human-Trained AI training data, filtering rules, and evaluation are described in [the model notes](server/ml/README.md).
