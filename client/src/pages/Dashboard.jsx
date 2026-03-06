import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Globe, Lock, Users, Clock, Zap, LogOut, Plus, Play, Edit2, Trash2, ArrowRight } from 'lucide-react';
import API_URL from '../config';
import GameModeSelector from '../components/GameModeSelector';

function Dashboard() {
    const [games, setGames] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [username, setUsername] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newGameName, setNewGameName] = useState('');
    const [newCrowdName, setNewCrowdName] = useState('The Crowd');
    const [selectedTime, setSelectedTime] = useState(0);
    const [isPublic, setIsPublic] = useState(true);
    const [gameMode, setGameMode] = useState('crowd');
    const [aiDifficulty, setAiDifficulty] = useState(3);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const userId = localStorage.getItem('userId');
        const isGuest = localStorage.getItem('isGuest') === 'true';
        const storedUsername = localStorage.getItem('username');

        if (!userId || isGuest) {
            navigate('/login');
            return;
        }

        setUsername(storedUsername);
        fetchGames();
    }, [navigate]);

    const fetchGames = async () => {
        try {
            setIsLoading(true);
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/games/user/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGames(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch games', err);
            toast.error('Failed to load games', { style: { background: '#ef4444', color: '#fff' } });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGame = async () => {
        if (!newGameName.trim()) {
            toast.error('Please enter a game name', { style: { background: '#334155', color: '#fff' } });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const gameData = {
                turnDuration: selectedTime,
                name: newGameName,
                isPublic,
                gameMode
            };

            // Add mode-specific data
            if (gameMode === 'crowd') {
                gameData.crowdName = newCrowdName;
            } else if (gameMode === 'ai') {
                gameData.aiDifficulty = aiDifficulty;
            }

            const res = await axios.post(`${API_URL}/api/games`, gameData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const successMessage = gameMode === '1v1'
                ? 'Game created! Waiting for opponent...'
                : 'Game created!';
            toast.success(successMessage, { icon: '✨', style: { background: '#334155', color: '#fff' } });

            setIsCreating(false);
            setNewGameName('');
            setNewCrowdName('The Crowd');
            setIsPublic(true);
            setGameMode('crowd');
            setAiDifficulty(3);
            navigate(`/game/${res.data._id}`);
        } catch (err) {
            toast.error('Failed to create game', { style: { background: '#ef4444', color: '#fff' } });
        }
    };

    const handleRename = async (gameId) => {
        if (!editingName.trim()) {
            toast.error('Game name cannot be empty');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/games/${gameId}`, {
                name: editingName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Game renamed!', { style: { background: '#334155', color: '#fff' } });
            setEditingId(null);
            fetchGames();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to rename game', { style: { background: '#ef4444', color: '#fff' } });
        }
    };

    const handleDelete = async (gameId, gameName) => {
        // Show confirmation toast
        toast((t) => (
            <div className="flex flex-col gap-3">
                <p className="font-semibold text-slate-800">Delete "{gameName}"?</p>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                const token = localStorage.getItem('token');
                                await axios.delete(`${API_URL}/api/games/${gameId}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                toast.success('Game deleted!', { icon: '🗑️', style: { background: '#334155', color: '#fff' } });
                                fetchGames();
                            } catch (err) {
                                toast.error(err.response?.data?.error || 'Failed to delete game');
                            }
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors flex-1"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-semibold hover:bg-slate-300 transition-colors flex-1"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), {
            duration: 5000,
            style: { background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }
        });
    };

    const handleLogout = () => {
        localStorage.clear();
        toast.success('Logged out safely', { icon: '👋', style: { background: '#334155', color: '#fff' } });
        navigate('/');
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    };

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 relative overflow-x-hidden text-slate-200">
            {/* Background elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-float"></div>
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-rose-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-float" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12"
                >
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-blue-400 mb-2">
                            Commander's Deck
                        </h1>
                        <p className="text-slate-400 text-lg">Welcome back, <span className="text-white font-bold">{username}</span></p>
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <Link to="/" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-slate-300 px-5 py-2.5 rounded-xl transition-all backdrop-blur-sm">
                            <Globe className="w-4 h-4" /> Home
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-5 py-2.5 rounded-xl transition-all backdrop-blur-sm"
                        >
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </motion.div>

                {/* Create Game Trigger */}
                <AnimatePresence>
                    {!isCreating && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, height: 0, margin: 0 }}
                            className="mb-10"
                        >
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full relative group overflow-hidden rounded-2xl p-1"
                            >
                                <div className="absolute inset-0 bg-blue-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                                <div className="relative bg-slate-900 border border-white/10 px-8 py-6 rounded-xl flex items-center justify-center gap-3 backdrop-blur-xl group-hover:bg-slate-900/80 transition-colors">
                                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                        <Plus className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <span className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">Forge New Arena</span>
                                </div>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create Game Form */}
                <AnimatePresence>
                    {isCreating && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -20, height: 0 }}
                            className="mb-12 overflow-hidden"
                        >
                            <div className="glass-panel p-6 md:p-8 rounded-3xl relative border-t border-l border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                                {/* Decorative corner */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>

                                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700/50">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                        Configure New Game
                                    </h2>
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="text-slate-500 hover:text-white transition-colors p-2"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Game Mode Selector */}
                                <div className="mb-8">
                                    <GameModeSelector
                                        selectedMode={gameMode}
                                        onModeChange={setGameMode}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-300 ml-1">Game Name</label>
                                        <input
                                            type="text"
                                            value={newGameName}
                                            onChange={(e) => setNewGameName(e.target.value)}
                                            className="w-full bg-slate-900/60 text-white px-5 py-3.5 rounded-xl border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                                            placeholder="e.g. The Final Stand"
                                        />
                                    </div>

                                    {/* Crowd Name */}
                                    {gameMode === 'crowd' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-300 ml-1">Crowd Name</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={newCrowdName}
                                                    onChange={(e) => setNewCrowdName(e.target.value)}
                                                    className="w-full bg-slate-900/60 text-white pl-12 pr-5 py-3.5 rounded-xl border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                                                    placeholder="The Horde"
                                                />
                                                <Users className="w-5 h-5 text-slate-500 absolute left-4 top-4" />
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Difficulty */}
                                    {gameMode === 'ai' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-300 ml-1 flex justify-between">
                                                <span>AI Difficulty</span>
                                                <span className="text-blue-400">
                                                    {['Novice', 'Veteran', 'Grandmaster'][Math.floor((aiDifficulty - 1) / 2)]}
                                                </span>
                                            </label>
                                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 h-[54px] flex items-center">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="6"
                                                    value={aiDifficulty}
                                                    onChange={(e) => setAiDifficulty(Number(e.target.value))}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 px-1 mt-1">
                                                <span>Easy</span>
                                                <span>Medium</span>
                                                <span>Hard</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    {/* Time Control */}
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300 ml-1">
                                            <Clock className="w-4 h-4 text-emerald-400" /> Turn Duration
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[10, 30, 60, 0].map((time) => (
                                                <button
                                                    key={time}
                                                    onClick={() => setSelectedTime(time)}
                                                    className={`relative px-2 py-3.5 rounded-xl font-bold text-sm transition-all border ${selectedTime === time
                                                        ? 'bg-emerald-600 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                                                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {time === 0 ? <span className="flex items-center justify-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Infinite</span> : `${time}s`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visibility */}
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300 ml-1">
                                            <Globe className="w-4 h-4 text-sky-400" /> Visibility
                                        </label>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setIsPublic(true)}
                                                className={`flex-1 p-3.5 rounded-xl border transition-all text-left flex items-center justify-center gap-2 ${isPublic
                                                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/50'
                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                <Globe className="w-4 h-4" /> <span className="font-bold">Public</span>
                                            </button>

                                            <button
                                                onClick={() => setIsPublic(false)}
                                                className={`flex-1 p-3.5 rounded-xl border transition-all text-left flex items-center justify-center gap-2 ${!isPublic
                                                    ? 'bg-violet-500/15 border-violet-500/50 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/50'
                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                <Lock className="w-4 h-4" /> <span className="font-bold">Private</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-6 border-t border-slate-700/50 mt-8">
                                    <button
                                        onClick={() => {
                                            setIsCreating(false);
                                            setNewGameName('');
                                            setNewCrowdName('The Crowd');
                                        }}
                                        className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateGame}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" /> Deploy Game
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Games List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1.5 h-8 bg-blue-500 rounded-full"></div>
                        <h2 className="text-3xl font-bold text-white">Active Campaigns</h2>
                        <span className="ml-2 bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-sm font-bold border border-slate-700">{games.length}</span>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="glass-panel p-6 rounded-2xl h-64 animate-pulse">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="h-8 bg-slate-700/50 rounded-lg w-1/2"></div>
                                        <div className="h-6 bg-slate-700/50 rounded-full w-20"></div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
                                        <div className="h-4 bg-slate-700/50 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-700/50 rounded w-2/3"></div>
                                    </div>
                                    <div className="mt-8 flex gap-3">
                                        <div className="h-10 bg-slate-700/50 rounded-lg flex-1"></div>
                                        <div className="h-10 bg-slate-700/50 rounded-lg w-12"></div>
                                        <div className="h-10 bg-slate-700/50 rounded-lg w-12"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : games.length === 0 ? (
                        <div className="glass-panel p-16 rounded-3xl text-center border-dashed border-2 border-slate-700 flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                <Zap className="w-10 h-10 text-slate-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">No Active Games</h3>
                            <p className="text-slate-400 text-lg mb-8 max-w-md">Your command center is empty. Forge a new arena to begin your conquest.</p>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:-translate-y-1 transition-transform"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence>
                                {games.map((game) => (
                                    <motion.div
                                        variants={itemVariants}
                                        layout
                                        key={game._id}
                                        className="glass-panel p-6 rounded-2xl relative group overflow-hidden border border-slate-700/50 hover:border-blue-500/50 transition-colors flex flex-col h-full"
                                    >
                                        {/* Status Glow */}
                                        <div className={`absolute top-0 right-0 w-32 h-32 blur-[64px] rounded-full -z-10 opacity-20 transition-opacity duration-500 group-hover:opacity-40
                                            ${game.status === 'active' ? 'bg-emerald-500' : game.status === 'completed' ? 'bg-slate-500' : 'bg-amber-500'}`}
                                        ></div>

                                        {editingId === game._id ? (
                                            <div className="mb-4 z-10 flex-1">
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    className="w-full bg-slate-900 border border-blue-500 text-white px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 mb-3 font-bold text-lg"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRename(game._id)}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRename(game._id)}
                                                        className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600/30 transition-colors"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="flex-1 bg-slate-800 text-slate-300 py-2 border border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col h-full z-10">
                                                <div className="flex items-start justify-between mb-4 gap-3">
                                                    <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-tight flex-1">
                                                        {game.name}
                                                    </h3>
                                                    <div className="flex flex-col gap-2 items-end shrink-0">
                                                        {/* Game Mode Badge */}
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${game.gameMode === 'ai'
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            : game.gameMode === '1v1'
                                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            }`}>
                                                            {game.gameMode === 'ai' ? '🤖 AI' : game.gameMode === '1v1' ? '👥 1v1' : '🎭 Crowd'}
                                                        </span>
                                                        {/* Details Badge */}
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase flex items-center gap-1 ${game.isPublic !== false
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                            }`}>
                                                            {game.isPublic !== false ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                            {game.isPublic !== false ? 'Public' : 'Private'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2.5 text-sm mb-6 flex-1 text-slate-400 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
                                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                                        <span className="text-slate-500">Status</span>
                                                        <span className={`font-bold uppercase tracking-wider text-xs px-2 py-0.5 rounded
                                                            ${game.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                game.status === 'completed' ? 'bg-slate-800 text-slate-400' : 'bg-amber-500/10 text-amber-400'}`}
                                                        >
                                                            {game.status}
                                                        </span>
                                                    </div>

                                                    {game.status !== 'completed' && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500">Turn</span>
                                                            <span className="font-bold text-white truncate max-w-[120px]">
                                                                {game.currentTurn === 'player' ? username : (game.crowdName || 'The Crowd')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {game.winner && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500">Winner</span>
                                                            <span className="font-bold text-amber-400 truncate max-w-[120px]">
                                                                {game.winner === 'player' ? username : (game.crowdName || 'The Crowd')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-800">
                                                        <div className="flex items-center gap-1.5 font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg">
                                                            <Heart className="w-3.5 h-3.5 fill-current" />
                                                            <span>{game.heartCount || 0}</span>
                                                        </div>
                                                        <span className="text-xs font-mono text-slate-600" title={game._id}>
                                                            ...{game._id.slice(-6)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 relative mt-auto">
                                                    <button
                                                        onClick={() => navigate(`/game/${game._id}`)}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 group/btn flex justify-center items-center gap-2"
                                                    >
                                                        <span>{game.status === 'completed' ? 'View Game' : 'Resume'}</span>
                                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(game._id);
                                                                setEditingName(game.name);
                                                            }}
                                                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition-all border border-slate-700 relative group/edit"
                                                            title="Rename"
                                                        >
                                                            <Edit2 className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(game._id, game.name)}
                                                            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 p-2.5 rounded-xl transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

export default Dashboard;
