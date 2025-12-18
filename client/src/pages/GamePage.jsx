import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Heart, ArrowLeft, Share2, Play, Pause, SkipBack, SkipForward, FastForward, Rewind, Film, XCircle, Sparkles, Check, X } from 'lucide-react';
import Board from '../components/Board';
import axios from 'axios';
import toast from 'react-hot-toast';

import { v4 as uuidv4 } from 'uuid';
import API_URL from '../config';

const socket = io(API_URL, {
    autoConnect: false
});

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
    const [isHearted, setIsHearted] = useState(false);
    const [isEditingCrowdName, setIsEditingCrowdName] = useState(false);
    const [tempCrowdName, setTempCrowdName] = useState('The Crowd');

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

        // Socket Auth
        const token = localStorage.getItem('token');
        if (token) {
            socket.auth = { token };
        } else {
            socket.auth = {};
        }
        socket.connect();

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
            socket.disconnect();
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

            // Check if user has hearted this game
            if (uId && loadedGame.hearts) {
                setIsHearted(loadedGame.hearts.includes(uId));
            }

            setGame(loadedGame);
            setTempCrowdName(loadedGame.crowdName || 'The Crowd');
        } catch (err) {
            console.error('Failed to load game', err);
            toast.error('Game not found');
            navigate('/dashboard');
        }
    };

    const handleColumnClick = (col) => {
        if (!game || isReplaying) return; // Block moves during replay

        if (role === 'player' && game.currentTurn === 'player') {
            socket.emit('make_move', { gameId: game._id, col });
        } else if (role === 'crowd' && game.currentTurn === 'crowd') {
            socket.emit('cast_vote', { gameId: game._id, col, crowdUserId });
        }
    };

    const handleForceMove = () => {
        if (game && role === 'player') {
            socket.emit('force_crowd_move', { gameId: game._id });
        }
    };

    const handleHeartClick = async () => {
        if (!userId) {
            toast.error('Please log in or create an account to heart a game', {
                duration: 4000,
                icon: '💔'
            });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (isHearted) {
                // Unheart
                await axios.delete(`${API_URL}/api/games/${gameId}/heart`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsHearted(false);
                toast.success('Removed from favorites');
                // Update game hearts count
                if (game) {
                    setGame({
                        ...game,
                        hearts: game.hearts.filter(id => id !== userId)
                    });
                }
            } else {
                // Heart
                await axios.post(`${API_URL}/api/games/${gameId}/heart`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsHearted(true);
                toast.success('Added to favorites!', { icon: '❤️' });
                // Update game hearts count
                if (game) {
                    setGame({
                        ...game,
                        hearts: [...(game.hearts || []), userId]
                    });
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update heart');
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Game link copied! Share it with the crowd!');
    };

    const handleCrowdNameUpdate = async () => {
        if (!tempCrowdName.trim()) {
            toast.error('Crowd name cannot be empty');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/games/${gameId}`, {
                crowdName: tempCrowdName.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGame(res.data);
            setIsEditingCrowdName(false);
            toast.success('Crowd renamed!');
        } catch (err) {
            toast.error('Failed to update crowd name');
            console.error(err);
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
            <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 font-sans">
                {/* Header Skeleton */}
                <div className="mb-4 w-full flex justify-between items-center px-4 max-w-2xl">
                    <div className="h-9 w-32 bg-gray-800 rounded animate-pulse"></div>
                    <div className="flex gap-2">
                        <div className="h-9 w-20 bg-gray-800 rounded animate-pulse"></div>
                        <div className="h-9 w-36 bg-gray-800 rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Legend Skeleton */}
                <div className="mb-6 flex justify-center gap-6 text-sm">
                    <div className="h-10 w-40 min-h-[2.5rem] bg-gray-800 rounded-lg animate-pulse border border-transparent px-4"></div>
                    <div className="h-10 w-40 min-h-[2.5rem] bg-gray-800 rounded-lg animate-pulse border border-transparent px-4"></div>
                </div>

                {/* Title/Turn Skeleton */}
                <div className="mb-8 flex flex-col items-center gap-2 px-4">
                    <div className="w-full max-w-xl flex justify-center">
                        <div className="h-10 w-full max-w-xl bg-gray-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-6 w-full flex justify-center">
                        <div className="h-6 w-32 bg-gray-800 rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Board Skeleton - Matches typical board aspect ratio */}
                <div className="w-full max-w-xl p-4">
                    <div className="aspect-[7/6] bg-blue-900/20 rounded-xl border-4 border-blue-900 p-2 grid grid-cols-7 gap-1 md:gap-2">
                        {Array(42).fill(0).map((_, i) => (
                            <div key={i} className="aspect-square bg-gray-800/50 rounded-full animate-pulse"></div>
                        ))}
                    </div>
                </div>

                {/* Footer Skeleton */}
                <div className="mt-12 flex flex-col items-center gap-2">
                    <div className="h-4 w-40 bg-gray-800 rounded animate-pulse"></div>
                    <div className="h-6 w-24 bg-gray-800 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-800 rounded animate-pulse"></div>
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
    const crowdName = game.crowdName || 'The Crowd';

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 font-sans">
            <div className="mb-4 w-full flex justify-between items-center px-4 max-w-2xl text-gray-400 text-sm">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="h-9 hover:text-white transition-colors flex items-center gap-1 font-medium px-2 -ml-2 rounded-lg hover:bg-gray-800"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Dashboard
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleHeartClick}
                        className={`h-9 min-w-[5rem] justify-center flex items-center gap-2 px-3 rounded-lg transition-all border ${isHearted
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30'
                            : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400 border-gray-600/30'
                            }`}
                        title={userId ? (isHearted ? 'Unheart' : 'Heart this game') : 'Login to heart'}
                    >
                        <Heart className={`w-5 h-5 ${isHearted ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : ''}`} />
                        <span className="font-semibold">{game?.hearts?.length || 0}</span>
                    </button>
                    <button
                        onClick={handleShare}
                        className="h-9 min-w-[9rem] justify-center flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 rounded-lg transition-colors border border-yellow-500/30"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>Invite Crowd</span>
                    </button>
                </div>
            </div>

            {/* Color Legend */}
            {/* Color Legend */}
            <div className="mb-6 flex justify-center gap-6 text-sm">
                <div className="w-40 h-10 min-h-[2.5rem] flex items-center justify-start gap-2 bg-gray-800/50 px-4 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-red-500 shrink-0"></div>
                    <span className="text-gray-300 truncate block w-[6.5rem] text-left">{playerName}</span>
                </div>
                <div className="w-40 h-10 min-h-[2.5rem] flex items-center justify-start gap-2 bg-gray-800/50 px-4 rounded-lg border border-gray-700">
                    <div className="w-6 h-6 rounded bg-yellow-400 shrink-0"></div>
                    <div className="w-[6.5rem] h-6 flex items-center">
                        {isEditingCrowdName ? (
                            <input
                                type="text"
                                value={tempCrowdName}
                                onChange={(e) => setTempCrowdName(e.target.value)}
                                className="w-full h-6 bg-gray-700 text-white px-2 rounded text-sm focus:outline-none focus:border-yellow-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCrowdNameUpdate();
                                    if (e.key === 'Escape') {
                                        setTempCrowdName(game.crowdName || 'The Crowd');
                                        setIsEditingCrowdName(false);
                                    }
                                }}
                                onBlur={() => {
                                    setTempCrowdName(game.crowdName || 'The Crowd');
                                    setIsEditingCrowdName(false);
                                }}
                            />
                        ) : (
                            <span
                                className={`text-gray-300 truncate block w-full text-left ${role === 'player' ? 'cursor-pointer hover:text-yellow-400 hover:underline decoration-dashed underline-offset-4' : ''}`}
                                onDoubleClick={() => {
                                    if (role === 'player') setIsEditingCrowdName(true);
                                }}
                                title={role === 'player' ? "Double click to rename" : ""}
                            >
                                {crowdName}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Replay Controls - sleek dark theme */}
            {isReplaying && (
                <div className="mb-8 bg-gray-800/80 backdrop-blur-md px-8 py-4 rounded-2xl border border-gray-700/50 shadow-xl flex flex-col items-center gap-3 animate-fade-in-up">
                    <div className="flex items-center gap-6">
                        <button onClick={goToStart} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Start">
                            <SkipBack className="w-6 h-6" />
                        </button>
                        <button onClick={goToPrevious} disabled={replayIndex === 0} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Previous">
                            <Rewind className="w-8 h-8" />
                        </button>

                        <button
                            onClick={toggleAutoPlay}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title={isAutoPlaying ? "Pause" : "Play"}
                        >
                            {isAutoPlaying ? (
                                <Pause className="w-8 h-8" />
                            ) : (
                                <Play className="w-8 h-8 ml-1" />
                            )}
                        </button>

                        <button onClick={goToNext} disabled={replayIndex === game.moves.length} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Next">
                            <FastForward className="w-8 h-8" />
                        </button>
                        <button onClick={goToEnd} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="End">
                            <SkipForward className="w-6 h-6" />
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

            <div className="mb-8 flex flex-col items-center gap-2 px-4">
                <div className="w-full max-w-xl flex justify-center">
                    <h1 className="text-2xl md:text-4xl h-10 w-full max-w-xl flex items-center justify-center text-center whitespace-nowrap font-bold">
                        {game.status === 'completed'
                            ? <span className="text-green-400">Winner: {game.winner === 'player' ? playerName : crowdName}</span>
                            : <span className={game.currentTurn === 'player' ? 'text-red-500' : 'text-yellow-500'}>
                                Turn: {game.currentTurn === 'player' ? playerName : crowdName}
                            </span>
                        }
                    </h1>
                </div>
                <div className="h-6 w-full flex justify-center">
                    <p
                        className={`h-6 flex items-center justify-center text-gray-400 transition-opacity duration-300 ${game.status !== 'completed' ? 'opacity-100 animate-pulse' : 'opacity-0'
                            }`}
                    >
                        {isMyTurn ? "Your Turn!" : "Waiting..."}
                    </p>
                </div>
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

            <div className="min-h-[420px]">
                <Board
                    board={displayBoard}
                    onColumnClick={handleColumnClick}
                    votes={role === 'crowd' && !isReplaying ? votes : null}
                />
            </div>

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
                        <span className="group-hover:inline-block">Enhance Enhance</span>
                        <Sparkles className="w-5 h-5" />
                    </button>
                </div>
            )}

            {isReplaying && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={exitReplay}
                        className="group bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                        <XCircle className="w-5 h-5" /> Return to Live
                    </button>
                </div>
            )}
        </div>
    );
}

export default GamePage;
