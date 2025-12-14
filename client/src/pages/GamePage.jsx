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
            // Handle populated singlePlayerId (object) or raw ID
            const spId = loadedGame.singlePlayerId;
            const spIdString = (spId && typeof spId === 'object') ? spId._id.toString() : spId?.toString();

            if (spIdString && spIdString === uId) {
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

    const spId = game.singlePlayerId;
    const playerName = (spId && typeof spId === 'object') ? spId.username : 'The One';

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 font-sans">
            <div className="mb-4 w-full flex justify-between items-center px-4 max-w-2xl text-gray-400 text-sm">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="hover:text-white transition-colors flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Dashboard
                </button>
            </div>

            {/* Color Legend */}
            <div className="mb-6 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-red-500"></div>
                    <span className="text-gray-300">{playerName} (Player)</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-yellow-400"></div>
                    <span className="text-gray-300">The Crowd</span>
                </div>
            </div>

            {/* Replay Controls - sleek dark theme */}
            {isReplaying && (
                <div className="mb-8 bg-gray-800/80 backdrop-blur-md px-8 py-4 rounded-2xl border border-gray-700/50 shadow-xl flex flex-col items-center gap-3 animate-fade-in-up">
                    <div className="flex items-center gap-6">
                        <button onClick={goToStart} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Start">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                        <button onClick={goToPrevious} disabled={replayIndex === 0} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Previous">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <button
                            onClick={toggleAutoPlay}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title={isAutoPlaying ? "Pause" : "Play"}
                        >
                            {isAutoPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </button>

                        <button onClick={goToNext} disabled={replayIndex === game.moves.length} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Next">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button onClick={goToEnd} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="End">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Minimalist Progress Bar */}
                    <div className="w-64 h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${(replayIndex / Math.max(1, game.moves.length)) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-xs font-mono text-gray-400">Move {replayIndex} / {game.moves.length}</p>
                </div>
            )}

            <div className="mb-8 text-center px-4">
                <h1 className="text-2xl md:text-4xl font-bold mb-2">
                    {game.status === 'completed'
                        ? <span className="text-green-400">Winner: {game.winner === 'player' ? playerName : 'The Crowd'}</span>
                        : <span className={game.currentTurn === 'player' ? 'text-red-500' : 'text-yellow-500'}>
                            Turn: {game.currentTurn === 'player' ? playerName : 'The Crowd'}
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
            {/* Floating Action Buttons */}
            {hasHistory && !isReplaying && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={startReplay}
                        className="group bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                        <span>🎬</span>
                        <span className="group-hover:inline-block">Replay Game</span>
                    </button>
                </div>
            )}

            {isReplaying && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={exitReplay}
                        className="group bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                        <span>🔴</span> Return to Live
                    </button>
                </div>
            )}
        </div>
    );
}

export default GamePage;
