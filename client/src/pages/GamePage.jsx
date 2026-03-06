import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Heart, ArrowLeft, Share2, Play, Pause, SkipBack, SkipForward, FastForward, Rewind, XCircle, Sparkles, X, Users, Copy } from 'lucide-react';
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from 'framer-motion';

import Board from '../components/Board';
import axios from 'axios';
import toast from 'react-hot-toast';

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
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [liveGame, setLiveGame] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [isHearted, setIsHearted] = useState(false);
    const [isEditingCrowdName, setIsEditingCrowdName] = useState(false);
    const [tempCrowdName, setTempCrowdName] = useState('The Crowd');
    const [showInviteModal, setShowInviteModal] = useState(false);

    const [stats, setStats] = useState({ player1Wins: 0, player2Wins: 0 });
    const [rematchRequests, setRematchRequests] = useState([]);

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);



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
            fetchStats(gameId);
        }

        socket.on('game_state', (data) => {
            if (isReplaying) {
                // Store live updates in background during replay
                setLiveGame(data);
            } else {
                setGame(data);
                if (data.savedVotes) {
                    setVotes(data.savedVotes);
                }
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

        // Rematch listeners
        socket.on('rematch_update', (data) => {
            setRematchRequests(data.requestedBy || []);
        });

        socket.on('game_reset', ({ newGameId }) => {
            toast.success('Starting new game!');
            navigate(`/game/${newGameId}`);
            // Reset state? Navigate handles unmount/mount usually, but strict mode might be tricky.
            // React Router navigate should clear the component state as it mounts a new instance for the new ID.
            window.location.reload(); // Force reload to be safe and clean socket states? Or just navigate?
            // Actually, simple navigate is better SPA experience. But ensure state is fresh.
            // The useEffect with [gameId] dependency dependency will trigger loadGame.
        });

        return () => {
            socket.off('game_state');
            socket.off('vote_update');
            socket.off('timer_sync');
            socket.off('rematch_update');
            socket.off('game_reset');
            socket.disconnect();
        };
    }, [gameId]); // Dependency on gameId triggers re-run when ID changes

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

    const fetchStats = async (gId) => {
        try {
            const res = await axios.get(`${API_URL}/api/games/${gId}/stats`);
            setStats(res.data);
        } catch (err) {
            console.error('Failed to fetch stats', err);
        }
    };

    const loadGame = async (gId, uId) => {
        try {
            const res = await axios.get(`${API_URL}/api/games/${gId}`);
            let loadedGame = res.data;

            // Determine role based on game mode
            const spId = loadedGame.singlePlayerId;
            const spIdString = (spId && typeof spId === 'object') ? spId._id.toString() : spId?.toString();

            let userRole = 'crowd'; // default

            if (loadedGame.gameMode === '1v1') {
                // Check if user is player1 or player2
                const p2Id = loadedGame.player2Id;
                const p2IdString = (p2Id && typeof p2Id === 'object') ? p2Id._id.toString() : p2Id?.toString();

                if (spIdString && spIdString === uId) {
                    userRole = 'player';
                } else if (p2IdString && p2IdString === uId) {
                    userRole = 'player2';
                } else if (!p2Id && uId) {
                    // Auto-join as player2 if:
                    // 1. No player2 exists yet
                    // 2. User is logged in
                    // 3. User is not player1
                    try {
                        const token = localStorage.getItem('token');
                        const joinRes = await axios.post(
                            `${API_URL}/api/games/${gId}/join`,
                            { role: 'player2' },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        loadedGame = joinRes.data; // Update with joined game
                        userRole = 'player2';
                        toast.success('Joined game as Player 2!');
                    } catch (joinErr) {
                        console.error('Failed to join as player2:', joinErr);
                        // If join fails, become spectator
                        userRole = 'spectator';
                    }
                } else {
                    userRole = 'spectator'; // Watching a 1v1 game (player2 already exists)
                }
            } else if (loadedGame.gameMode === 'ai') {
                // Only the game owner can play in AI mode
                if (spIdString && spIdString === uId) {
                    userRole = 'player';
                } else {
                    userRole = 'spectator';
                }
            } else { // crowd mode
                if (spIdString && spIdString === uId) {
                    userRole = 'player';
                } else {
                    userRole = 'crowd';
                }
            }

            socket.emit('join_game', { gameId: gId, role: userRole });
            setRole(userRole);

            // Check if user has hearted this game
            if (uId) {
                try {
                    const token = localStorage.getItem('token');
                    if (token) {
                        const heartRes = await axios.get(`${API_URL}/api/games/${gId}/is-hearted`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        setIsHearted(heartRes.data.isHearted);
                    }
                } catch (hErr) {
                    console.error('Failed to check heart status', hErr);
                }
            }

            setGame(loadedGame);
            if (loadedGame.savedVotes) {
                setVotes(loadedGame.savedVotes);
            }
            setTempCrowdName(loadedGame.crowdName || 'The Crowd');
        } catch (err) {
            console.error('Failed to load game', err);
            toast.error('Game not found');
            navigate('/dashboard');
        }
    };

    const handleColumnClick = (col) => {
        if (!game || isReplaying) return; // Block moves during replay

        const gameMode = game.gameMode || 'crowd';

        // Handle different game modes
        if (gameMode === 'crowd') {
            if (role === 'player' && game.currentTurn === 'player') {
                socket.emit('make_move', { gameId: game._id, col });
            } else if (role === 'crowd' && game.currentTurn === 'crowd') {
                socket.emit('cast_vote', { gameId: game._id, col });
            }
        } else if (gameMode === '1v1') {
            if (role === 'player' && game.currentTurn === 'player') {
                socket.emit('make_move', { gameId: game._id, col });
            } else if (role === 'player2' && game.currentTurn === 'player2') {
                socket.emit('make_move', { gameId: game._id, col });
            }
        } else if (gameMode === 'ai') {
            if (role === 'player' && game.currentTurn === 'player') {
                socket.emit('make_move', { gameId: game._id, col });
            }
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

            // Debug: Check if token exists
            if (!token) {
                console.error('No token found in localStorage');
                toast.error('Authentication token not found. Please log in again.');
                navigate('/');
                return;
            }

            console.log('Token exists, making request...');

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
                        heartCount: Math.max(0, (game.heartCount || 0) - 1)
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
                        heartCount: (game.heartCount || 0) + 1
                    });
                }
            }
        } catch (err) {
            console.error('Heart error:', err);
            console.error('Error response:', err.response);

            // More specific error messages
            if (err.response?.status === 401) {
                toast.error('Session expired. Please log in again.');
                navigate('/');
            } else {
                toast.error(err.response?.data?.error || 'Failed to update heart');
            }
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied! Scan QR to join on mobile.');
        setShowInviteModal(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
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

    const handleRematch = () => {
        if (!userId) {
            toast.error('You must be logged in to request a rematch');
            return;
        }
        socket.emit('request_rematch', { gameId: game._id });
        toast('Requesting rematch...', { icon: '🔄' });
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
            <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center py-8 font-sans">
                {/* Header Skeleton */}
                <div className="mb-4 w-full flex justify-between items-center px-4 max-w-2xl">
                    <div className="h-10 w-40 bg-gray-800 rounded-xl animate-pulse"></div>
                    <div className="flex gap-2">
                        <div className="h-10 w-24 bg-gray-800 rounded-xl animate-pulse"></div>
                        <div className="h-10 w-36 bg-gray-800 rounded-xl animate-pulse"></div>
                    </div>
                </div>

                {/* Legend Skeleton */}
                <div className="mb-8 flex flex-col md:flex-row justify-center gap-4 w-full max-w-2xl px-4">
                    <div className="h-16 w-full bg-gray-800 border border-gray-700 rounded-2xl animate-pulse"></div>
                    <div className="h-16 w-full bg-gray-800 border border-gray-700 rounded-2xl animate-pulse"></div>
                </div>

                {/* Title Skeleton */}
                <div className="mb-10 w-full max-w-md h-12 bg-gray-800 rounded-2xl animate-pulse px-4"></div>

                {/* Board Skeleton */}
                <div className="w-full max-w-[95vw] sm:max-w-2xl p-4 flex justify-center">
                    <div className="bg-blue-600 p-4 md:p-6 rounded-xl shadow-lg border-b-4 border-blue-800 relative">
                        <div className="flex flex-col gap-2 md:gap-3">
                            {Array(6).fill(0).map((_, rIndex) => (
                                <div key={rIndex} className="flex gap-2 md:gap-3 justify-center">
                                    {Array(7).fill(0).map((_, cIndex) => (
                                        <div key={`${rIndex}-${cIndex}`} className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-blue-800 rounded-full animate-pulse shadow-inner"></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isMyTurn = (
        (role === 'player' && game.currentTurn === 'player') ||
        (role === 'player2' && game.currentTurn === 'player2') ||
        (role === 'crowd' && game.currentTurn === 'crowd')
    );

    // Determine which board to display
    const displayBoard = isReplaying
        ? reconstructBoard((Array.isArray(game.moves) ? game.moves : []).slice(0, replayIndex))
        : game.board;

    const hasHistory = game.moves && game.moves.length > 0;

    // Get player names based on game mode
    const spId = game.singlePlayerId;
    const player1Name = (spId && typeof spId === 'object') ? spId.username : 'Player 1';

    const gameMode = game.gameMode || 'crowd';
    let player2Name = 'Player 2';

    if (gameMode === 'crowd') {
        player2Name = game.crowdName || 'The Crowd';
    } else if (gameMode === '1v1') {
        const p2Id = game.player2Id;
        player2Name = (p2Id && typeof p2Id === 'object') ? p2Id.username : 'Player 2';
    } else if (gameMode === 'ai') {
        player2Name = 'AI';
    }

    return (
        <div className="min-h-screen pt-8 pb-12 px-4 flex flex-col items-center bg-gray-900 text-gray-200">
            <div className="w-full max-w-2xl">
                {/* Top Action Bar */}
                <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-bold"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handleHeartClick}
                            className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors border font-bold ${isHearted
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-gray-800 text-gray-400 border-gray-700'
                                }`}
                            title={userId ? (isHearted ? 'Unheart' : 'Heart this game') : 'Login to heart'}
                        >
                            <Heart className={`w-4 h-4 ${isHearted ? 'fill-current text-red-500' : ''}`} />
                            <span>{game?.heartCount || 0}</span>
                        </button>

                        {(gameMode === 'crowd' || gameMode === '1v1') && (
                            <button
                                onClick={handleShare}
                                className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-4 py-2 rounded-xl transition-colors border border-blue-500/30 font-bold"
                            >
                                <Share2 className="w-4 h-4" />
                                <span>Invite</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Sign In Notice for 1v1 */}
                <AnimatePresence>
                    {gameMode === '1v1' && !userId && !game.player2Id && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 overflow-hidden"
                        >
                            <div className="bg-sky-500/10 border border-sky-500/30 text-sky-300 px-4 py-3 rounded-xl flex items-center gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                                <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
                                <span className="font-semibold text-sm">Please <strong>sign in</strong> to join this game as Player 2!</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Player Legend Cards */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                    {/* Player 1 Card */}
                    <div className="bg-gray-800 border-l-4 border-red-500 p-4 rounded-xl flex-1 flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-red-500 shrink-0"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Player 1</span>
                                <span className="font-bold text-white text-lg truncate max-w-[120px]">{player1Name}</span>
                            </div>
                        </div>
                        {gameMode === '1v1' && (
                            <div className="text-xl font-bold text-red-400 bg-red-900/30 px-3 py-1 rounded-lg">
                                {stats.player1Wins || 0}
                            </div>
                        )}
                    </div>

                    {/* Player 2 / Crowd / AI Card */}
                    <div className="bg-gray-800 border-l-4 border-yellow-500 p-4 rounded-xl flex-1 flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-4 w-full">
                            <div className="w-8 h-8 rounded-full bg-yellow-500 shrink-0"></div>
                            <div className="flex flex-col w-full">
                                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    {gameMode === 'ai' ? 'AI' : gameMode === '1v1' ? 'Player 2' : 'The Crowd'}
                                </span>

                                {isEditingCrowdName && gameMode === 'crowd' ? (
                                    <div className="flex gap-2 w-full mt-1">
                                        <input
                                            type="text"
                                            value={tempCrowdName}
                                            onChange={(e) => setTempCrowdName(e.target.value)}
                                            className="h-8 bg-gray-900 border border-yellow-500/50 text-white px-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 w-full"
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
                                    </div>
                                ) : (
                                    <span
                                        className={`font-bold text-white text-lg truncate max-w-[120px] ${role === 'player' && gameMode === 'crowd'
                                            ? 'cursor-pointer hover:text-yellow-400 hover:underline'
                                            : ''
                                            }`}
                                        onDoubleClick={() => {
                                            if (role === 'player' && gameMode === 'crowd') setIsEditingCrowdName(true);
                                        }}
                                        title={role === 'player' && gameMode === 'crowd' ? "Double click to rename" : player2Name}
                                    >
                                        {player2Name}
                                    </span>
                                )}
                            </div>
                        </div>
                        {gameMode === '1v1' && (
                            <div className="text-xl font-bold text-yellow-500 bg-yellow-900/30 px-3 py-1 rounded-lg">
                                {stats.player2Wins || 0}
                            </div>
                        )}
                    </div>
                </div>

                {/* Replay Controls */}
                {isReplaying && (
                    <div className="mb-10 w-full flex justify-center">
                        <div className="bg-gray-800 px-6 py-4 rounded-xl border border-gray-700 shadow-md flex flex-col items-center gap-4">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <button onClick={goToStart} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors bg-gray-900" title="Start">
                                    <SkipBack className="w-5 h-5" />
                                </button>
                                <button onClick={goToPrevious} disabled={replayIndex === 0} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-gray-900 bg-gray-900" title="Previous">
                                    <Rewind className="w-6 h-6" />
                                </button>

                                <button
                                    onClick={toggleAutoPlay}
                                    className={`p-4 rounded-full transition-colors ${isAutoPlaying ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}
                                    title={isAutoPlaying ? "Pause" : "Play"}
                                >
                                    {isAutoPlaying ? (
                                        <Pause className="w-8 h-8" />
                                    ) : (
                                        <Play className="w-8 h-8 ml-1" />
                                    )}
                                </button>

                                <button onClick={goToNext} disabled={replayIndex === game.moves.length} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-gray-900 bg-gray-900" title="Next">
                                    <FastForward className="w-6 h-6" />
                                </button>
                                <button onClick={goToEnd} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors bg-gray-900" title="End">
                                    <SkipForward className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Minimalist Progress Bar */}
                            <div className="w-full sm:w-80 h-2 bg-gray-900 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                    style={{ width: `${(replayIndex / Math.max(1, game.moves.length)) * 100}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center w-full px-2">
                                <span className="text-xs font-bold text-gray-400 bg-gray-900 px-3 py-1 rounded border border-gray-700">Turn {replayIndex} of {game.moves.length}</span>

                                {/* Vote Count Badge during Replay */}
                                {replayIndex > 0 && game.moves[replayIndex - 1] && game.moves[replayIndex - 1].player === 'crowd' && (
                                    <div className="flex items-center gap-1.5 bg-yellow-900/30 text-yellow-500 px-3 py-1 rounded border border-yellow-500/30 text-xs font-bold">
                                        <Users className="w-3.5 h-3.5" />
                                        <span>{game.moves[replayIndex - 1].voteCount || 0} votes</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Status Board */}
                <div className="mb-8 w-full">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg text-center max-w-xl mx-auto flex flex-col min-h-[200px] overflow-hidden">
                        {/* Status Message Section - Heading stays centered relative to its own flex-1 area */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <h2 className="text-2xl font-bold transition-all duration-300" style={{
                                color: game.status === 'completed'
                                    ? (game.winner === 'player' ? '#f43f5e' : game.winner === 'player2' || game.winner === 'crowd' ? '#eab308' : '#9ca3af')
                                    : (game.currentTurn === 'player' ? '#f43f5e' : game.currentTurn === 'player2' || game.currentTurn === 'crowd' ? '#eab308' : '#818cf8')
                            }}>
                                {game.status === 'completed' ? (
                                    <>Winner: {game.winner === 'player' ? player1Name : game.winner === 'player2' || game.winner === 'crowd' ? player2Name : game.winner === 'ai' ? 'AI' : 'Draw'}</>
                                ) : (
                                    <>{game.currentTurn === 'player' ? player1Name : game.currentTurn === 'player2' || game.currentTurn === 'crowd' ? player2Name : 'AI'}'s Turn</>
                                )}
                            </h2>
                        </div>

                        {/* Crowd stats - Reserved space in flow to prevent layout shift */}
                        {gameMode === 'crowd' && game.status !== 'completed' && (
                            <div className={`px-6 pb-6 mt-[-10px] transition-all duration-300 ${game.currentTurn === 'crowd' && timer !== null ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <div className="flex flex-col items-center gap-4 pt-4 border-t border-gray-700/50">
                                    <div className="flex justify-center gap-4 w-full">
                                        <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50 flex-1">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center justify-center gap-1.5 leading-none">
                                                <Users className="w-3 h-3" /> Participants
                                            </div>
                                            <div className="text-2xl font-bold text-yellow-500">
                                                {Object.values(votes).reduce((a, b) => a + b, 0)}
                                            </div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50 flex-1">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 leading-none">
                                                Time Left
                                            </div>
                                            <div className={`text-2xl font-bold ${timer === 'infinite' ? 'text-blue-400' : timer <= 5 ? 'text-red-500' : 'text-green-500'}`}>
                                                {timer === 'infinite' ? '∞' : `${timer}s`}
                                            </div>
                                        </div>
                                    </div>

                                    {timer === 'infinite' && role === 'player' && (
                                        <button
                                            onClick={handleForceMove}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            Force Crowd Move <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Rematch Button - Stable Position */}
                        {game.status === 'completed' && gameMode === '1v1' && (role === 'player' || role === 'player2') && (
                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-center w-full">
                                {rematchRequests.includes(userId) ? (
                                    <span className="text-yellow-500 font-bold text-sm">Awaiting opponent...</span>
                                ) : (
                                    <button
                                        onClick={handleRematch}
                                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        {rematchRequests.length > 0 ? "Opponent wants Rematch!" : "Play Again"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* The Main Board */}
                <div className="w-full flex justify-center mb-12 relative z-20">
                    <Board
                        board={displayBoard}
                        onColumnClick={handleColumnClick}
                        votes={role === 'crowd' && gameMode === 'crowd' && !isReplaying ? votes : null}
                    />
                </div>

                {/* Footer Status */}
                <div className="text-center bg-gray-800 px-6 py-4 rounded-xl border border-gray-700 max-w-md w-full mx-auto mb-20">
                    <p className="text-sm text-gray-400">Logged in as: <span className={`font-bold uppercase ${role === 'player' ? 'text-red-400' : 'text-yellow-500'}`}>{role}</span></p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-[10px] font-mono text-gray-500 truncate" title={game._id}>{game._id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{game.name}</h3>
                </div>

                {/* Floating Action Buttons */}
                {
                    hasHistory && !isReplaying && (
                        <div className="fixed bottom-6 right-6 z-50">
                            <button
                                onClick={startReplay}
                                className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-6 py-3 rounded-xl font-bold transition-colors shadow-lg flex items-center gap-2"
                            >
                                <Play className="w-5 h-5" />
                                <span>Replay</span>
                            </button>
                        </div>
                    )
                }

                {
                    isReplaying && (
                        <div className="fixed bottom-6 right-6 z-50">
                            <button
                                onClick={exitReplay}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg flex items-center gap-2"
                            >
                                <XCircle className="w-5 h-5" /> Exit Replay
                            </button>
                        </div>
                    )
                }

                {/* Invite Modal */}
                {
                    showInviteModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
                            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-bold text-white mb-2">
                                        Invite Players
                                    </h3>
                                    <p className="text-gray-400 text-sm">
                                        Scan this QR code or copy the link to join the game.
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-xl mx-auto mb-6 w-fit">
                                    <QRCode
                                        value={window.location.href}
                                        size={180}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 text-xs text-gray-400 font-mono truncate text-center select-all">
                                        {window.location.href}
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-5 h-5" />
                                        Copy Link
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}

export default GamePage;
