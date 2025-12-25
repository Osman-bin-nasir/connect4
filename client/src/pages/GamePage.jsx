import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Heart, ArrowLeft, Share2, Play, Pause, SkipBack, SkipForward, FastForward, Rewind, Film, XCircle, Sparkles, Check, X, Users } from 'lucide-react';

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

    const [stats, setStats] = useState({ player1Wins: 0, player2Wins: 0 });
    const [rematchRequests, setRematchRequests] = useState([]);

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
            fetchStats(gameId);
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

        const gameMode = game.gameMode || 'crowd';

        // Handle different game modes
        if (gameMode === 'crowd') {
            if (role === 'player' && game.currentTurn === 'player') {
                socket.emit('make_move', { gameId: game._id, col });
            } else if (role === 'crowd' && game.currentTurn === 'crowd') {
                socket.emit('cast_vote', { gameId: game._id, col, crowdUserId });
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

    const isMyTurn = (
        (role === 'player' && game.currentTurn === 'player') ||
        (role === 'player2' && game.currentTurn === 'player2') ||
        (role === 'crowd' && game.currentTurn === 'crowd')
    );

    // Determine which board to display
    const displayBoard = isReplaying
        ? reconstructBoard((game.moves || []).slice(0, replayIndex))
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

            {/* Sign In Notice for 1v1 */}
            {gameMode === '1v1' && !userId && !game.player2Id && (
                <div className="mb-4 bg-blue-600/20 border border-blue-500/50 text-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
                    <span className="text-xl">ℹ️</span>
                    <span>Please <strong>sign in</strong> to join this game as Player 2!</span>
                </div>
            )}

            {/* Color Legend with Scores */}
            <div className="mb-6 flex justify-center gap-6 text-sm">
                <div className="w-48 h-12 flex items-center justify-between gap-2 bg-gray-800/50 px-4 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded bg-red-500 shrink-0"></div>
                        <span className="text-gray-300 truncate block max-w-[5rem] text-left" title={player1Name}>{player1Name}</span>
                    </div>
                    {gameMode === '1v1' && (
                        <div className="text-xl font-bold text-gray-400 bg-gray-900/50 px-2 rounded">
                            {stats.player1Wins || 0}
                        </div>
                    )}
                </div>

                <div className="w-48 h-12 flex items-center justify-between gap-2 bg-gray-800/50 px-4 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded bg-yellow-400 shrink-0"></div>
                        <div className="max-w-[5rem] h-6 flex items-center">
                            {isEditingCrowdName && gameMode === 'crowd' ? (
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
                                    className={`text-gray-300 truncate block w-full text-left ${role === 'player' && gameMode === 'crowd'
                                        ? 'cursor-pointer hover:text-yellow-400 hover:underline decoration-dashed underline-offset-4'
                                        : ''
                                        }`}
                                    onDoubleClick={() => {
                                        if (role === 'player' && gameMode === 'crowd') setIsEditingCrowdName(true);
                                    }}
                                    title={role === 'player' && gameMode === 'crowd' ? "Double click to rename" : player2Name} // fixed title
                                >
                                    {player2Name}
                                </span>
                            )}
                        </div>
                    </div>
                    {gameMode === '1v1' && (
                        <div className="text-xl font-bold text-gray-400 bg-gray-900/50 px-2 rounded">
                            {stats.player2Wins || 0}
                        </div>
                    )}
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
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                        <span>Move {replayIndex} / {game.moves.length}</span>
                        {/* Vote Count Badge */}
                        {replayIndex > 0 && game.moves[replayIndex - 1] && game.moves[replayIndex - 1].player === 'crowd' && (
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)] animate-in fade-in zoom-in slide-in-from-bottom-1">
                                <Users className="w-3.5 h-3.5" />
                                <span className="font-bold text-yellow-300">{game.moves[replayIndex - 1].voteCount || 0}</span>
                                <span className="opacity-80">votes</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="mb-8 flex flex-col items-center gap-2 px-4">
                <div className="w-full max-w-xl flex flex-col items-center justify-center">
                    <h1 className="text-2xl md:text-4xl h-10 w-full flex items-center justify-center text-center whitespace-nowrap font-bold">
                        {game.status === 'completed'
                            ? <span className="text-green-400">
                                Winner: {game.winner === 'player' ? player1Name :
                                    game.winner === 'player2' ? player2Name :
                                        game.winner === 'ai' ? 'AI' :
                                            game.winner === 'crowd' ? player2Name :
                                                'Draw'}
                            </span>
                            : <span className={
                                game.currentTurn === 'player' ? 'text-red-500' :
                                    game.currentTurn === 'player2' ? 'text-blue-400' :
                                        game.currentTurn === 'ai' ? 'text-purple-400' :
                                            'text-yellow-500'
                            }>
                                Turn: {game.currentTurn === 'player' ? player1Name :
                                    game.currentTurn === 'player2' ? player2Name :
                                        game.currentTurn === 'ai' ? '🤖 AI (thinking...)' :
                                            player2Name}
                            </span>
                        }
                    </h1>

                    {/* Rematch Button for 1v1 */}
                    {game.status === 'completed' && gameMode === '1v1' && (role === 'player' || role === 'player2') && (
                        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                            {rematchRequests.includes(userId) ? (
                                <span className="text-yellow-400 font-mono animate-pulse">Waiting for opponent...</span>
                            ) : (
                                <button
                                    onClick={handleRematch}
                                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-green-500/20 transition-all transform hover:scale-105 flex items-center gap-2"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    {rematchRequests.length > 0 ? "Opponent wants Rematch!" : "Play Again"}
                                </button>
                            )}
                        </div>
                    )}

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

            {/* Only show timer and voting for crowd mode */}
            {gameMode === 'crowd' && timer !== null && game.currentTurn === 'crowd' && game.status !== 'completed' && (
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
                    votes={role === 'crowd' && gameMode === 'crowd' && !isReplaying ? votes : null}
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
