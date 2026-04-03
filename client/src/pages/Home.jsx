import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../config';

import { ArrowRight, CircleChevronRight, Clock, Globe, Heart, RefreshCw, Shield, Trophy, Users } from 'lucide-react';

function Home() {
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [popularGames, setPopularGames] = useState([]);
    const [openLobbies, setOpenLobbies] = useState([]);
    const [activeTab, setActiveTab] = useState('open1v1');
    const [showAllOpenLobbies, setShowAllOpenLobbies] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshingLobbies, setIsRefreshingLobbies] = useState(false);
    const [userHearts, setUserHearts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        const isGuest = localStorage.getItem('isGuest') === 'true';
        const authenticated = Boolean(storedUserId && token && !isGuest);

        setUserId(authenticated ? storedUserId : null);
        setIsLoggedIn(authenticated);

        let isMounted = true;

        async function hydrateHome() {
            await Promise.all([
                fetchLeaderboard(),
                fetchPopularGames(),
                fetchOpenLobbies(),
                authenticated ? fetchUserHearts() : Promise.resolve()
            ]);

            if (isMounted) {
                setIsLoading(false);
            }
        }

        hydrateHome();

        const intervalId = window.setInterval(() => {
            fetchOpenLobbies({ background: true });
        }, 15000);

        return () => {
            isMounted = false;
            window.clearInterval(intervalId);
        };
    }, []);

    async function fetchUserHearts() {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/games/my-hearts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserHearts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch user hearts', err);
        }
    }

    async function fetchLeaderboard() {
        try {
            const res = await axios.get(`${API_URL}/api/games/leaderboard`);
            setLeaderboard(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch leaderboard', err);
        }
    }

    async function fetchPopularGames() {
        try {
            const res = await axios.get(`${API_URL}/api/games/popular`);
            setPopularGames(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch popular games', err);
        }
    }

    async function fetchOpenLobbies({ background = false } = {}) {
        try {
            if (background) {
                setIsRefreshingLobbies(true);
            }

            const res = await axios.get(`${API_URL}/api/games/lobbies/1v1/open`);
            const nextLobbies = Array.isArray(res.data) ? res.data : [];
            setOpenLobbies(nextLobbies);
            if (nextLobbies.length <= 4) {
                setShowAllOpenLobbies(false);
            }
        } catch (err) {
            console.error('Failed to fetch open 1v1 lobbies', err);
        } finally {
            if (background) {
                setIsRefreshingLobbies(false);
            }
        }
    }

    async function handleHeartClick(gameId, isHearted) {
        if (!isLoggedIn) {
            toast.error('Please log in to heart a game', { icon: '💔' });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (isHearted) {
                await axios.delete(`${API_URL}/api/games/${gameId}/heart`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserHearts(prev => prev.filter(id => id !== gameId));
            } else {
                await axios.post(`${API_URL}/api/games/${gameId}/heart`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Added to favorites!', { icon: '❤️' });
                setUserHearts(prev => [...prev, gameId]);
            }

            fetchPopularGames();
        } catch (err) {
            toast.error('Failed to update heart');
        }
    }

    function handleJoinAsCrowd() {
        if (!gameIdInput.trim()) {
            toast.error('Please enter a Game ID');
            return;
        }

        navigate(`/game/${gameIdInput.trim()}`);
    }

    async function handleLobbyAction(lobby) {
        const hostId = typeof lobby.singlePlayerId === 'object'
            ? lobby.singlePlayerId?._id?.toString()
            : lobby.singlePlayerId?.toString();
        const isOwnLobby = Boolean(userId && hostId === userId);

        if (!isLoggedIn) {
            navigate('/login');
            return;
        }

        if (isOwnLobby) {
            navigate(`/game/${lobby._id}`);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/games/${lobby._id}/join`, {
                role: 'player2'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Joined game as Player 2!');
            navigate(`/game/${lobby._id}`);
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error('That lobby was just filled.');
                fetchOpenLobbies({ background: true });
                return;
            }

            toast.error(err.response?.data?.error || 'Failed to join game');
            fetchOpenLobbies({ background: true });
        }
    }

    function formatRelativeTime(dateString) {
        const createdAt = new Date(dateString).getTime();
        const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));

        if (diffSeconds < 60) return 'just now';

        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m ago`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;

        return new Date(dateString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    }

    function formatTurnDuration(turnDuration) {
        return turnDuration === 0 ? 'Infinite turns' : `${turnDuration}s turns`;
    }

    function getFeaturedGames() {
        const allGames = Array.isArray(popularGames) ? popularGames : [];
        const active = allGames.filter(g => g.status === 'active');
        const completed = allGames.filter(g => g.status === 'completed');

        let picked = [...active.slice(0, 2), ...completed.slice(0, 2)];

        if (picked.length < 4) {
            const pickedIds = new Set(picked.map(g => g._id));
            const remaining = allGames.filter(g => !pickedIds.has(g._id));
            picked = [...picked, ...remaining.slice(0, 4 - picked.length)];
        }

        return picked;
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.1, duration: 0.6, ease: 'easeOut' }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    function renderTrendingGameCard(game) {
        const isHearted = userHearts.includes(game._id);
        const creatorName = game.singlePlayerId?.username || 'Anonymous';

        return (
            <motion.div
                key={game._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => navigate(`/game/${game._id}`)}
                className="glass-panel glass-panel-hover p-5 rounded-2xl cursor-pointer relative group overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 pr-4">
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors duration-300 line-clamp-1">
                            {game.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Shield className="w-3.5 h-3.5" />
                            <span className="truncate">by {creatorName}</span>
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleHeartClick(game._id, isHearted);
                        }}
                        className={`transition-all duration-300 p-2.5 rounded-full z-10 ${isHearted
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-slate-800/50 text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                            }`}
                        title={isLoggedIn ? (isHearted ? 'Unheart' : 'Heart this game') : 'Login to heart'}
                    >
                        <Heart className={`w-5 h-5 ${isHearted ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-rose-400 font-medium bg-rose-500/10 px-2.5 py-1 rounded-full">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                            {game.heartCount || 0}
                        </span>

                        <span className="flex items-center gap-1.5 text-slate-300 font-medium bg-slate-500/10 px-2.5 py-1 rounded-full">
                            <Users className="w-3.5 h-3.5" />
                            {game.gameMode === '1v1' ? '1v1' : game.gameMode === 'ai' ? 'vAI' : 'Crowd'}
                        </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${game.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : game.status === 'completed'
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        {game.status}
                    </span>
                </div>
            </motion.div>
        );
    }

    function renderOpenLobbyCard(lobby) {
        const hostId = typeof lobby.singlePlayerId === 'object'
            ? lobby.singlePlayerId?._id?.toString()
            : lobby.singlePlayerId?.toString();
        const hostName = lobby.singlePlayerId?.username || 'Anonymous';
        const isOwnLobby = Boolean(userId && hostId === userId);
        const ctaLabel = !isLoggedIn ? 'Login to Join' : isOwnLobby ? 'Open Game' : 'Join Game';
        const showTurnDuration = lobby.turnDuration > 0;

        return (
            <motion.div
                key={lobby._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden border border-slate-700/50 group"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-white line-clamp-1">
                            {lobby.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                            <Shield className="w-3.5 h-3.5" />
                            <span className="truncate">hosted by {hostName}</span>
                        </div>
                    </div>

                    {isOwnLobby && (
                        <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300">
                            Your Game
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                        <Users className="w-3.5 h-3.5" />
                        Waiting 1v1
                    </span>
                    {showTurnDuration && (
                        <span className="flex items-center gap-1.5 rounded-full bg-slate-800/70 px-2.5 py-1 text-xs font-bold text-slate-300">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTurnDuration(lobby.turnDuration)}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                        <Globe className="w-3.5 h-3.5" />
                        Public
                    </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-700/50 pt-4">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Opened
                        </div>
                        <div className="text-sm font-semibold text-white">
                            {formatRelativeTime(lobby.createdAt)}
                        </div>
                    </div>

                    <button
                        onClick={() => handleLobbyAction(lobby)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition-all ${!isLoggedIn
                            ? 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                            : isOwnLobby
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25'
                                : 'bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:border-white/50'
                            }`}
                    >
                        <span>{ctaLabel}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        );
    }

    const featuredGames = getFeaturedGames();
    const displayedOpenLobbies = showAllOpenLobbies ? openLobbies : openLobbies.slice(0, 4);
    const hasMoreOpenLobbies = openLobbies.length > 4;

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 relative flex flex-col items-center overflow-x-hidden">
            <div className="absolute top-20 -left-20 w-72 h-72 bg-slate-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float"></div>
            <div className="absolute top-40 -right-20 w-72 h-72 bg-slate-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="w-full max-w-7xl flex flex-col items-center z-10"
            >
                <motion.div variants={itemVariants} className="text-center mb-16 max-w-3xl">
                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
                        <span className="text-white">Jack vs The Subreddit</span>
                        <br />
                        <span className="text-gradient-primary">Connect 4</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-light px-4">
                        Can Jack beat the Subreddit?<br></br>Practice against friends or our AI until the challenge begins.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        {isLoggedIn ? (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/dashboard')}
                                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-white/10 hover:bg-white/20 text-white border border-white/30 hover:border-white/60 transition-all flex items-center justify-center gap-2"
                            >
                                Enter Dashboard <CircleChevronRight className="w-5 h-5" />
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-white/10 hover:bg-white/20 text-white border border-white/30 hover:border-white/60 transition-all"
                            >
                                Login to Play
                            </motion.button>
                        )}

                        <div className="flex gap-2 w-full sm:w-auto relative">
                            <input
                                type="text"
                                value={gameIdInput}
                                onChange={(e) => setGameIdInput(e.target.value)}
                                placeholder="Enter Game ID..."
                                className="w-full sm:w-64 bg-slate-900/50 text-white px-5 py-4 rounded-xl border border-slate-700 focus:border-white/50 focus:ring-2 focus:ring-white/10 outline-none backdrop-blur-md transition-all font-mono"
                            />
                            <button
                                onClick={handleJoinAsCrowd}
                                className="absolute right-2 top-2 bottom-2 bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-lg font-semibold transition-colors border border-slate-600"
                            >
                                Join
                            </button>
                        </div>
                    </div>

                    {!isLoggedIn && (
                        <div className="mt-6 flex flex-col items-center gap-1">
                            <p className="text-slate-500">
                                New here?{' '}
                                <span onClick={() => navigate('/signup')} className="text-white hover:text-slate-300 font-medium cursor-pointer transition-colors">
                                    Create an account
                                </span>
                            </p>
                            <p className="text-slate-500/70 text-xs">
                                (No email required to play)
                            </p>
                        </div>
                    )}
                </motion.div>

                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-8">
                    <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col gap-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${activeTab === 'open1v1' ? 'bg-sky-500/20' : 'bg-rose-500/20'}`}>
                                            {activeTab === 'open1v1'
                                                ? <Users className="w-6 h-6 text-sky-300" />
                                                : <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />}
                                        </div>
                                        <h2 className="text-3xl font-bold text-white tracking-tight">
                                            {activeTab === 'open1v1' ? 'Open 1v1' : 'Trending Games'}
                                        </h2>
                                    </div>
                                    <p className="text-slate-500 mt-3 max-w-2xl">
                                        {activeTab === 'open1v1'
                                            ? 'Public head-to-head games waiting for a second player show up here automatically.'
                                            : 'The most loved games across the arena, picked from what players are hearting right now.'}
                                    </p>
                                </div>

                                <div className="inline-flex rounded-2xl border border-slate-700/50 bg-slate-900/60 p-1 backdrop-blur-sm">
                                    <button
                                        onClick={() => setActiveTab('open1v1')}
                                        className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'open1v1'
                                            ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                                            : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                    >
                                        Open 1v1 ({openLobbies.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('trending')}
                                        className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'trending'
                                            ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                                            : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                    >
                                        Trending ({featuredGames.length})
                                    </button>
                                </div>
                            </div>

                            {activeTab === 'open1v1' && !isLoading && (
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLobbies ? 'animate-spin text-sky-400' : ''}`} />
                                    <span>{isRefreshingLobbies ? 'Refreshing lobby list...' : 'Refreshes every 15 seconds'}</span>
                                </div>
                            )}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === 'open1v1' ? (
                                <motion.div
                                    key="open1v1"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {isLoading ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {[1, 2, 3, 4].map((n) => (
                                                <div key={n} className="glass-panel p-5 rounded-2xl h-52 animate-pulse">
                                                    <div className="h-6 bg-slate-700/50 rounded-md w-2/3 mb-4"></div>
                                                    <div className="h-4 bg-slate-700/50 rounded-md w-1/2 mb-6"></div>
                                                    <div className="flex gap-2 mb-8">
                                                        <div className="h-8 w-24 bg-slate-700/50 rounded-full"></div>
                                                        <div className="h-8 w-28 bg-slate-700/50 rounded-full"></div>
                                                    </div>
                                                    <div className="h-10 bg-slate-700/50 rounded-xl w-32 ml-auto"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : openLobbies.length > 0 ? (
                                        <div className="space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {displayedOpenLobbies.map(renderOpenLobbyCard)}
                                            </div>

                                            {hasMoreOpenLobbies && (
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => setShowAllOpenLobbies(prev => !prev)}
                                                        className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/30"
                                                    >
                                                        {showAllOpenLobbies ? 'Show fewer games' : `Show more games (${openLobbies.length - 4} more)`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="glass-panel p-12 rounded-2xl text-center border-dashed border-2 border-slate-700">
                                            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                            <h3 className="text-xl font-bold text-slate-300 mb-2">No Open 1v1 Games</h3>
                                            <p className="text-slate-500 max-w-md mx-auto">
                                                Public 1v1 games waiting for an opponent will appear here. {isLoggedIn ? 'You can create one from your dashboard.' : 'Log in to create one and get matched faster.'}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="trending"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {isLoading ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {[1, 2, 3, 4].map((n) => (
                                                <div key={n} className="glass-panel p-5 rounded-2xl h-36 animate-pulse">
                                                    <div className="h-6 bg-slate-700/50 rounded-md w-3/4 mb-4"></div>
                                                    <div className="h-4 bg-slate-700/50 rounded-md w-1/2"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : featuredGames.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {featuredGames.map(renderTrendingGameCard)}
                                        </div>
                                    ) : (
                                        <div className="glass-panel p-12 rounded-2xl text-center border-dashed border-2 border-slate-700">
                                            <Heart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                            <h3 className="text-xl font-bold text-slate-300 mb-2">No Trending Games</h3>
                                            <p className="text-slate-500">Be the first to create and popularize a game!</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500/20 rounded-xl">
                                <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">Hall of Fame</h2>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col gap-4">
                                {[1, 2, 3].map((n) => (
                                    <div key={n} className="glass-panel h-20 rounded-2xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : leaderboard.length === 0 ? (
                            <div className="glass-panel p-8 rounded-2xl text-center">
                                <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">The throne is empty. Claim it.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <AnimatePresence>
                                    {leaderboard.slice(0, 3).map((player, index) => {
                                        const isFirst = index === 0;
                                        const isSecond = index === 1;
                                        const isThird = index === 2;

                                        let bgClass = 'bg-slate-800/40';
                                        let borderClass = 'border-slate-700';
                                        let textClass = 'text-slate-400';
                                        let glowClass = '';

                                        if (isFirst) {
                                            bgClass = 'bg-amber-500/15';
                                            borderClass = 'border-amber-500/30';
                                            textClass = 'text-amber-400';
                                            glowClass = 'shadow-[0_0_20px_rgba(245,158,11,0.15)]';
                                        } else if (isSecond) {
                                            bgClass = 'bg-slate-300/10';
                                            borderClass = 'border-slate-400/30';
                                            textClass = 'text-slate-300';
                                        } else if (isThird) {
                                            bgClass = 'bg-orange-400/10';
                                            borderClass = 'border-orange-900/50';
                                            textClass = 'text-orange-400';
                                        }

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                key={player._id}
                                                className={`relative flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md ${bgClass} ${borderClass} ${glowClass} hover:bg-slate-800/60 transition-colors`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`text-2xl font-black font-mono w-8 text-center ${textClass}`}>
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-lg ${isFirst ? 'text-white' : 'text-slate-200'}`}>
                                                            {player.username}
                                                        </h4>
                                                        {isFirst && <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Grandmaster</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                                                    <Trophy className={`w-4 h-4 ${isFirst ? 'text-amber-400' : 'text-slate-500'}`} />
                                                    <span className="font-mono font-bold text-white">{player.wins}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="w-full max-w-7xl mt-16 mb-6 text-center z-10 flex flex-col gap-2 relative"
            >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                <p className="text-slate-400 text-sm mt-6 flex items-center justify-center gap-1.5">
                    Developed with <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" /> by <a href="https://www.linkedin.com/in/osman-bin-nasir/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-slate-300 font-bold transition-colors">Osman Bin Nasir</a>
                </p>
                <p className="text-slate-500 text-xs">
                    Special thanks to <span className="text-slate-300 font-medium tracking-wide">u/Techie_Jack</span> for the subdomain and <span className="text-slate-300 font-medium tracking-wide">u/DeadSubDoc</span> for the jack.fun integration.
                </p>
            </motion.div>
        </div>
    );
}

export default Home;
