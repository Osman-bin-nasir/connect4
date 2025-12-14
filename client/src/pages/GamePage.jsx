import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Board from '../components/Board';
import axios from 'axios';
import toast from 'react-hot-toast';

import { v4 as uuidv4 } from 'uuid';
import API_URL from '../config';

const socket = io(API_URL);

function GamePage() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const [game, setGame] = useState(null);
    const [role, setRole] = useState(null);
    const [votes, setVotes] = useState({});
    const [uniqueVoters, setUniqueVoters] = useState(0);
    const [timer, setTimer] = useState(null);
    const [userId, setUserId] = useState(null);
    const [crowdUserId, setCrowdUserId] = useState(null);
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [liveGame, setLiveGame] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);

        // Persistent Crowd ID (for anti-spam)
        let cId = localStorage.getItem('crowdUserId');
        if (!cId) {
            cId = uuidv4();
            localStorage.setItem('crowdUserId', cId);
        }
        setCrowdUserId(cId);

        // If we have a gameId from URL, join it
        if (gameId) {
            loadGame(gameId, id);
        }

        socket.on('game_state', (data) => {
            if (isReplaying) {
                // Store live updates in background during replay
                setLiveGame(data);
            } else {
                setGame(data);
            }
        });

        socket.on('vote_update', (data) => {
            // data can be just votes object OR { votes, voterCount }
            if (data.votes) {
                setVotes(data.votes);
                setUniqueVoters(data.voterCount || 0);
            } else {
                setVotes(data);
            }
        });

        socket.on('timer_sync', (time) => {
            setTimer(time);
        });

        return () => {
            socket.off('game_state');
            socket.off('vote_update');
            socket.off('timer_sync');
        };
    }, [gameId]);

    // Auto-play effect
    useEffect(() => {
        let interval;
        if (isAutoPlaying && isReplaying && game && game.moves) {
            interval = setInterval(() => {
                setReplayIndex((prev) => {
                    if (prev >= game.moves.length) {
                        setIsAutoPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isAutoPlaying, isReplaying, game]);

    const loadGame = async (gId, uId) => {
        try {
            const res = await axios.get(`${API_URL}/api/games/${gId}`);
            const loadedGame = res.data;

            // Determine role: if user is the player, set role as player, otherwise crowd
            if (loadedGame.singlePlayerId && loadedGame.singlePlayerId.toString() === uId) {
                socket.emit('join_game', { gameId: gId, role: 'player' });
                setRole('player');
            } else {
                // Crowd joining
                socket.emit('join_game', { gameId: gId, role: 'crowd' });
                setRole('crowd');
            }

            setGame(loadedGame);
        } catch (err) {
            console.error('Failed to load game', err);
            toast.error('Game not found');
            navigate('/dashboard');
        }
    };

    const handleColumnClick = (col) => {
        if (!game || isReplaying) return; // Block moves during replay

        if (role === 'player' && game.currentTurn === 'player') {
            socket.emit('make_move', { gameId: game._id, col, userId });
        } else if (role === 'crowd' && game.currentTurn === 'crowd') {
            socket.emit('cast_vote', { gameId: game._id, col, crowdUserId });
        }
    };

    const handleForceMove = () => {
        if (game && role === 'player') {
            socket.emit('force_crowd_move', { gameId: game._id, userId });
        }
    };

    // Replay functions
    const reconstructBoard = (moves) => {
        const board = Array(6).fill().map(() => Array(7).fill(0));
        moves.forEach((move) => {
            const playerValue = move.player === 'player' ? 1 : 2;
            // Find lowest empty row in column
            for (let r = 5; r >= 0; r--) {
                if (board[r][move.col] === 0) {
                    board[r][move.col] = playerValue;
                    break;
                }
            }
        });
        return board;
    };

    const startReplay = () => {
        if (!game || !game.moves || game.moves.length === 0) return;
        setLiveGame(game); // Save current state
        setIsReplaying(true);
        setReplayIndex(0);
        setIsAutoPlaying(false);
    };

    const exitReplay = () => {
        setIsReplaying(false);
        setIsAutoPlaying(false);
        if (liveGame) {
            setGame(liveGame); // Restore live state
        }
    };

    const goToStart = () => { setIsAutoPlaying(false); setReplayIndex(0); };
    const goToPrevious = () => { setIsAutoPlaying(false); setReplayIndex(Math.max(0, replayIndex - 1)); };
    const goToNext = () => { setIsAutoPlaying(false); setReplayIndex(Math.min(game.moves.length, replayIndex + 1)); };
    const goToEnd = () => { setIsAutoPlaying(false); setReplayIndex(game.moves.length); };
    const toggleAutoPlay = () => setIsAutoPlaying(!isAutoPlaying);

    if (!game) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading game...</p>
                </div>
            </div>
        );
    }

    const isMyTurn = (role === 'player' && game.currentTurn === 'player') || (role === 'crowd' && game.currentTurn === 'crowd');

    // Determine which board to display
    const displayBoard = isReplaying
        ? reconstructBoard((game.moves || []).slice(0, replayIndex))
        : game.board;

    const hasHistory = game.moves && game.moves.length > 0;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 font-sans">
            <div className="mb-4 w-full flex justify-between items-center px-4 max-w-2xl">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                    ← Back to Dashboard
                </button>
                {hasHistory && !isReplaying && (
                    <button
                        onClick={startReplay}
                        className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"
                    >
                        🎬 Replay Game
                    </button>
                )}
                {isReplaying && (
                    <button
                        onClick={exitReplay}
                        className="bg-red-600 px-4 py-2 rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2"
                    >
                        🔴 Return to Live
                    </button>
                )}
            </div>

            {/* Color Legend */}
            <div className="mb-6 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-red-500"></div>
                    <span className="text-gray-300">The One (Player)</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-yellow-400"></div>
                    <span className="text-gray-300">The Crowd</span>
                </div>
            </div>

            {/* Replay Controls */}
            {isReplaying && (
                <div className="mb-6 bg-gray-800 px-6 py-4 rounded-lg border border-blue-500/50">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <button onClick={goToStart} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="Start">⏮</button>
                        <button onClick={goToPrevious} disabled={replayIndex === 0} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Previous">⏪</button>

                        <button
                            onClick={toggleAutoPlay}
                            className={`px-4 py-1 rounded transition-colors flex items-center gap-1 ${isAutoPlaying ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}
                            title={isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}
                        >
                            {isAutoPlaying ? '⏸️' : '▶️'}
                        </button>

                        <span className="text-blue-400 font-mono px-3 min-w-[100px] text-center">
                            Move {replayIndex} / {game.moves.length}
                        </span>

                        <button onClick={goToNext} disabled={replayIndex === game.moves.length} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Next">⏩</button>
                        <button onClick={goToEnd} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="End">⏭</button>
                    </div>
                    <p className="text-xs text-center text-gray-400">Viewing game history • {liveGame && liveGame !== game ? '🔴 Live game updated in background' : ''}</p>
                </div>
            )}

            <div className="mb-8 text-center px-4">
                <h1 className="text-2xl md:text-4xl font-bold mb-2">
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
                    <span className="text-sm text-gray-400 font-sans">
                        Unique Voters: {uniqueVoters}
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
                board={displayBoard}
                onColumnClick={handleColumnClick}
                votes={role === 'crowd' && !isReplaying ? votes : null}
            />

            <div className="mt-12 text-center text-gray-500">
                <p>You are playing as: <span className={`font-bold uppercase ${role === 'player' ? 'text-red-500' : 'text-yellow-500'}`}>{role}</span></p>
                <p className="text-xs mt-2 font-mono bg-gray-800 px-2 py-1 rounded inline-block">ID: {game._id}</p>
                <p className="text-sm mt-2 text-gray-400">Game: {game.name}</p>
            </div>
        </div>
    );
}

export default GamePage;
