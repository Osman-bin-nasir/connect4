import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Board from './components/Board';
import axios from 'axios';

const socket = io('http://localhost:3001');

function App() {
  const [game, setGame] = useState(null);
  const [role, setRole] = useState(null); // 'player' or 'crowd'
  const [votes, setVotes] = useState({});
  const [timer, setTimer] = useState(null);
  const [selectedTime, setSelectedTime] = useState(30); // Default 30s
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Basic guest auth
    const initUser = async () => {
      let id = localStorage.getItem('userId');
      if (!id) {
        try {
          const res = await axios.post('http://localhost:3001/api/users/guest');
          id = res.data._id;
          localStorage.setItem('userId', id);
        } catch (err) {
          console.error("Auth error", err);
        }
      }
      setUserId(id);
    };
    initUser();

    socket.on('game_state', (data) => {
      setGame(data);
    });

    socket.on('vote_update', (data) => {
      setVotes(data);
    });

    socket.on('timer_sync', (time) => {
      setTimer(time);
    });

    return () => {
      socket.off('game_state');
      socket.off('vote_update');
      socket.off('timer_sync');
    };
  }, []);

  const createGame = async () => {
    try {
      const res = await axios.post('http://localhost:3001/api/games', { turnDuration: selectedTime });
      const newGame = res.data;
      await joinGame(newGame._id, 'player');
    } catch (err) {
      console.error("Create game error", err);
    }
  };

  const joinGame = async (gameId, roleToJoin) => {
    if (!gameId) return;
    try {
      if (roleToJoin === 'player') {
        await axios.post(`http://localhost:3001/api/games/${gameId}/join`, { userId, role: 'player' });
      }
      socket.emit('join_game', { gameId, role: roleToJoin });
      setRole(roleToJoin);
    } catch (err) {
      console.error("Join game error", err);
      alert("Failed to join game. Check ID or if player slot is taken.");
    }
  };

  const handleColumnClick = (col) => {
    if (!game) return;

    if (role === 'player' && game.currentTurn === 'player') {
      socket.emit('make_move', { gameId: game._id, col, userId });
    } else if (role === 'crowd' && game.currentTurn === 'crowd') {
      socket.emit('cast_vote', { gameId: game._id, col });
    }
  };

  const handleForceMove = () => {
    if (game && role === 'player') {
      socket.emit('force_crowd_move', { gameId: game._id, userId });
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans">
        <h1 className="text-5xl font-extrabold mb-12 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500">
          1 vs The Crowd
        </h1>
        <div className="flex flex-col gap-6 items-center">
          <div className="flex gap-4 mb-4">
            {[10, 30, 60, 0].map(time => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${selectedTime === time ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-300'}`}
              >
                {time === 0 ? 'Infinite' : `${time}s`}
              </button>
            ))}
          </div>

          <button
            onClick={createGame}
            className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
          >
            Create Game (Play as The One)
          </button>

          <div className="flex gap-2 items-center mt-8 bg-gray-800 p-4 rounded-xl">
            <input
              type="text"
              placeholder="Enter Game ID"
              id="gameIdInput"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button
              onClick={() => joinGame(document.getElementById('gameIdInput').value, 'crowd')}
              className="bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
            >
              Join Crowd
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMyTurn = (role === 'player' && game.currentTurn === 'player') || (role === 'crowd' && game.currentTurn === 'crowd');

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 font-sans">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">
          {game.status === 'completed'
            ? <span className="text-green-400">Winner: {game.winner === 'player' ? 'The One' : 'The Crowd'}</span>
            : <span className={game.currentTurn === 'player' ? 'text-red-500' : 'text-yellow-500'}>
              Turn: {game.currentTurn === 'player' ? 'The One' : 'The Crowd'}
            </span>
          }
        </h1>
        {game.status !== 'completed' && (
          <p className="text-gray-400 animate-pulse">
            {isMyTurn ? "Your Turn!" : "Waiting..."}
          </p>
        )}
      </div>

      {timer !== null && game.currentTurn === 'crowd' && game.status !== 'completed' && (
        <div className="text-3xl font-mono text-yellow-400 mb-6 bg-gray-800 px-4 py-2 rounded-lg border border-yellow-500/30 flex flex-col items-center gap-2">
          <span>
            {timer === 'infinite' ? '∞ Infinite Time' : `Time Left: ${timer}s`}
          </span>
          {timer === 'infinite' && role === 'player' && (
            <button
              onClick={handleForceMove}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500 transition-colors"
            >
              End Voting & Move
            </button>
          )}
        </div>
      )}

      <Board
        board={game.board}
        onColumnClick={handleColumnClick}
        votes={role === 'crowd' ? votes : null}
      />

      <div className="mt-12 text-center text-gray-500">
        <p>You are playing as: <span className={`font-bold uppercase ${role === 'player' ? 'text-red-500' : 'text-yellow-500'}`}>{role}</span></p>
        <p className="text-xs mt-2 font-mono bg-gray-800 px-2 py-1 rounded inline-block">ID: {game._id}</p>
      </div>
    </div>
  );
}

export default App;
