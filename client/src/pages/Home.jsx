import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../config';

import { Heart, Trophy, Users, Shield, Zap, CircleChevronRight } from 'lucide-react';

function Home() {
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [popularGames, setPopularGames] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userHearts, setUserHearts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);
        setIsLoggedIn(!!id);

        const fetchData = async () => {
            setIsLoading(true);
            const promises = [fetchLeaderboard(), fetchPopularGames()];
            if (id) {
                promises.push(fetchUserHearts());
            }
            await Promise.all(promises);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const fetchUserHearts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/games/my-hearts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserHearts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch user hearts', err);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/games/leaderboard`);
            setLeaderboard(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch leaderboard', err);
        }
    };

    const fetchPopularGames = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/games/popular`);
            setPopularGames(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch popular games', err);
        }
    };

    const handleHeartClick = async (gameId, isHearted) => {
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
    };

    const handleJoinAsCrowd = () => {
        if (!gameIdInput.trim()) {
            toast.error('Please enter a Game ID');
            return;
        }
        navigate(`/game/${gameIdInput}`);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.1, duration: 0.6, ease: "easeOut" }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const renderGameCard = (game) => {
        const isHearted = userHearts.includes(game._id);
        const creatorName = game.singlePlayerId?.username || 'Anonymous';

        return (
            <motion.div
                variants={itemVariants}
                key={game._id}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => navigate(`/game/${game._id}`)}
                className="glass-panel glass-panel-hover p-5 rounded-2xl cursor-pointer relative group overflow-hidden"
            >
                {/* Accent line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

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
                        className={`transition-all duration-300 p-2.5 rounded-full z-10 
                            ${isHearted ? 'bg-red-500/20 text-red-500' : 'bg-slate-800/50 text-slate-400 hover:bg-red-500/10 hover:text-red-400'}`}
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

                        <span className="flex items-center gap-1.5 text-blue-400 font-medium bg-blue-500/10 px-2.5 py-1 rounded-full">
                            <Users className="w-3.5 h-3.5" />
                            {game.gameMode === '1v1' ? '1v1' : game.gameMode === 'ai' ? 'vAI' : 'Crowd'}
                        </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${game.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            game.status === 'completed' ? 'bg-slate-500/20 text-slate-400' :
                                'bg-amber-500/20 text-amber-400'}`}>
                        {game.status}
                    </span>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 relative flex flex-col items-center overflow-x-hidden">

            {/* Background decorative blobs */}
            <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float"></div>
            <div className="absolute top-40 -right-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="w-full max-w-7xl flex flex-col items-center z-10"
            >
                {/* Hero Section */}
                <motion.div variants={itemVariants} className="text-center mb-16 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-sm text-slate-300 mb-6 backdrop-blur-md">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>The ultimate multiplayer experience</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
                        <span className="text-white">Face off against </span>
                        <br />
                        <span className="text-gradient-primary">The Crowd</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-light px-4">
                        Will you conquer the collective mind, or be crushed by the hive? Play 1v1, against our AI, or let the internet decide your fate in real-time.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        {isLoggedIn ? (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/dashboard')}
                                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2"
                            >
                                Enter Dashboard <CircleChevronRight className="w-5 h-5" />
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all"
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
                                className="w-full sm:w-64 bg-slate-900/50 text-white px-5 py-4 rounded-xl border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none backdrop-blur-md transition-all font-mono"
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
                        <p className="mt-6 text-slate-500">
                            New here?{' '}
                            <span onClick={() => navigate('/signup')} className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer transition-colors">
                                Create an account
                            </span>
                        </p>
                    )}
                </motion.div>

                {/* Split Content Section */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-8">

                    {/* Left Col: Popular Games */}
                    <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-500/20 rounded-xl">
                                <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">Trending Games</h2>
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {[1, 2, 3, 4].map((n) => (
                                    <div key={n} className="glass-panel p-5 rounded-2xl h-36 animate-pulse">
                                        <div className="h-6 bg-slate-700/50 rounded-md w-3/4 mb-4"></div>
                                        <div className="h-4 bg-slate-700/50 rounded-md w-1/2"></div>
                                    </div>
                                ))}
                            </div>
                        ) : popularGames && popularGames.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {(() => {
                                    const allGames = Array.isArray(popularGames) ? popularGames : [];
                                    const active = allGames.filter(g => g.status === 'active');
                                    const completed = allGames.filter(g => g.status === 'completed');

                                    let picked = [];
                                    const activeSlice = active.slice(0, 2);
                                    const completedSlice = completed.slice(0, 2);
                                    picked = [...activeSlice, ...completedSlice];

                                    // Fill remaining slots if either category has fewer than 2
                                    if (picked.length < 4) {
                                        const pickedIds = new Set(picked.map(g => g._id));
                                        const remaining = allGames.filter(g => !pickedIds.has(g._id));
                                        picked = [...picked, ...remaining.slice(0, 4 - picked.length)];
                                    }

                                    return picked.map(renderGameCard);
                                })()}
                            </div>
                        ) : (
                            <div className="glass-panel p-12 rounded-2xl text-center border-dashed border-2 border-slate-700">
                                <Heart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-300 mb-2">No Trending Games</h3>
                                <p className="text-slate-500">Be the first to create and popularize a game!</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Right Col: Hall of Fame */}
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

                                        let bgClass = "bg-slate-800/40";
                                        let borderClass = "border-slate-700";
                                        let textClass = "text-slate-400";
                                        let glowClass = "";

                                        if (isFirst) {
                                            bgClass = "bg-amber-500/15";
                                            borderClass = "border-amber-500/30";
                                            textClass = "text-amber-400";
                                            glowClass = "shadow-[0_0_20px_rgba(245,158,11,0.15)]";
                                        } else if (isSecond) {
                                            bgClass = "bg-slate-300/10";
                                            borderClass = "border-slate-400/30";
                                            textClass = "text-slate-300";
                                        } else if (isThird) {
                                            bgClass = "bg-orange-400/10";
                                            borderClass = "border-orange-900/50";
                                            textClass = "text-orange-400";
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
        </div>
    );
}

export default Home;
