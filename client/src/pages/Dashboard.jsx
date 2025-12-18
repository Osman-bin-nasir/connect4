import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Heart, Globe, Lock, Users, Clock, Zap } from 'lucide-react';
import API_URL from '../config';

function Dashboard() {
    const [games, setGames] = useState([]);
    const [username, setUsername] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newGameName, setNewGameName] = useState('');
    const [newCrowdName, setNewCrowdName] = useState('The Crowd');
    const [selectedTime, setSelectedTime] = useState(30);
    const [isPublic, setIsPublic] = useState(true);
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
            const userId = localStorage.getItem('userId');
            const res = await axios.get(`${API_URL}/api/games/user/${userId}`);
            setGames(res.data);
        } catch (err) {
            console.error('Failed to fetch games', err);
            toast.error('Failed to load games');
        }
    };

    const handleCreateGame = async () => {
        if (!newGameName.trim()) {
            toast.error('Please enter a game name');
            return;
        }

        try {
            const userId = localStorage.getItem('userId');
            const res = await axios.post(`${API_URL}/api/games`, {
                turnDuration: selectedTime,
                name: newGameName,
                crowdName: newCrowdName,
                userId,
                isPublic
            });

            toast.success('Game created!');
            setIsCreating(false);
            setNewGameName('');
            setNewCrowdName('The Crowd');
            setIsPublic(true); // Reset to default
            navigate(`/game/${res.data._id}`);
        } catch (err) {
            toast.error('Failed to create game');
        }
    };

    const handleRename = async (gameId) => {
        if (!editingName.trim()) {
            toast.error('Game name cannot be empty');
            return;
        }

        try {
            const userId = localStorage.getItem('userId');
            await axios.put(`${API_URL}/api/games/${gameId}`, {
                name: editingName,
                userId
            });

            toast.success('Game renamed!');
            setEditingId(null);
            fetchGames();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to rename game');
        }
    };

    const handleDelete = async (gameId, gameName) => {
        // Show confirmation toast
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-semibold">Delete "{gameName}"?</p>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                const userId = localStorage.getItem('userId');
                                await axios.delete(`${API_URL}/api/games/${gameId}`, {
                                    data: { userId }
                                });
                                toast.success('Game deleted!');
                                fetchGames();
                            } catch (err) {
                                toast.error(err.response?.data?.error || 'Failed to delete game');
                            }
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), {
            duration: 5000
        });
    };

    const handleLogout = () => {
        localStorage.clear();
        toast.success('Logged out');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white py-8 font-sans">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500">
                            Dashboard
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm md:text-base">Welcome back, {username}!</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-gray-700 px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        Logout
                    </button>
                </div>

                {/* Create Game Button */}
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="mb-8 bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        + Create New Game
                    </button>
                )}

                {isCreating && (
                    <div className="mb-12 bg-gray-800/80 backdrop-blur-md p-6 md:p-8 rounded-2xl border border-gray-700 shadow-2xl animate-fade-in-up">
                        <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                            Configure New Game
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-400">Game Name</label>
                                <input
                                    type="text"
                                    value={newGameName}
                                    onChange={(e) => setNewGameName(e.target.value)}
                                    className="w-full bg-gray-900/50 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all"
                                    placeholder="e.g. My Epic Game"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-400">Crowd Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newCrowdName}
                                        onChange={(e) => setNewCrowdName(e.target.value)}
                                        className="w-full bg-gray-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-600 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all"
                                        placeholder="The Crowd"
                                    />
                                    <Users className="w-5 h-5 text-gray-500 absolute left-3 top-3.5" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            {/* Time Control */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                                    <Clock className="w-4 h-4" /> Turn Duration
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[10, 30, 60, 0].map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`relative px-2 py-3 rounded-xl font-bold text-sm transition-all border ${selectedTime === time
                                                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-400 shadow-lg shadow-green-500/20 scale-105'
                                                : 'bg-gray-700/50 text-gray-400 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                                                }`}
                                        >
                                            {time === 0 ? <span className="flex items-center justify-center gap-1"><Zap className="w-3 h-3" /> Infinite</span> : `${time}s`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Visibility */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                                    <Globe className="w-4 h-4" /> Visibility
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setIsPublic(true)}
                                        className={`flex-1 p-3 rounded-xl border transition-all text-left group ${isPublic
                                            ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                            : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <div className={`flex items-center gap-2 font-bold mb-1 ${isPublic ? 'text-blue-400' : 'text-gray-300'}`}>
                                            <Globe className="w-4 h-4" /> Public
                                        </div>
                                        <p className="text-xs text-gray-500 group-hover:text-gray-400">Visible to everyone on the dashboard.</p>
                                    </button>

                                    <button
                                        onClick={() => setIsPublic(false)}
                                        className={`flex-1 p-3 rounded-xl border transition-all text-left group ${!isPublic
                                            ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                            : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <div className={`flex items-center gap-2 font-bold mb-1 ${!isPublic ? 'text-purple-400' : 'text-gray-300'}`}>
                                            <Lock className="w-4 h-4" /> Private
                                        </div>
                                        <p className="text-xs text-gray-500 group-hover:text-gray-400">Only accessible via direct link.</p>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewGameName('');
                                    setNewCrowdName('The Crowd');
                                }}
                                className="px-6 py-2.5 rounded-xl font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGame}
                                className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-105 transition-all"
                            >
                                Create Game
                            </button>
                        </div>
                    </div>
                )}

                {/* Games List */}
                <div>
                    <h2 className="text-3xl font-bold mb-6">Your Games</h2>

                    {games.length === 0 ? (
                        <div className="bg-gray-800 p-12 rounded-xl text-center">
                            <p className="text-gray-400 text-lg">No games yet. Create one to get started!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {games.map((game) => (
                                <div
                                    key={game._id}
                                    className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-yellow-500/50 transition-all"
                                >
                                    {editingId === game._id ? (
                                        <div className="mb-3">
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 mb-2"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRename(game._id)}
                                                    className="bg-green-600 px-3 py-1 rounded text-sm font-semibold hover:bg-green-500"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="bg-gray-600 px-3 py-1 rounded text-sm font-semibold hover:bg-gray-500"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-2xl font-bold text-yellow-400">{game.name}</h3>
                                            <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium ${game.isPublic !== false
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                {game.isPublic !== false ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                {game.isPublic !== false ? 'Public' : 'Private'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-2 text-sm text-gray-400 mb-4">
                                        <p>Status: <span className="capitalize font-semibold">{game.status}</span></p>
                                        <p>Turn: <span className="font-semibold">{game.currentTurn === 'player' ? username : (game.crowdName || 'The Crowd')}</span></p>
                                        {game.winner && (
                                            <p>Winner: <span className="text-green-400 font-semibold">{game.winner === 'player' ? username : (game.crowdName || 'The Crowd')}</span></p>
                                        )}
                                        <div className="flex gap-4 mt-2">
                                            <span className="flex items-center gap-1 font-semibold text-red-400">
                                                <Heart className="w-4 h-4 fill-red-400" />
                                                <span>{game.hearts?.length || 0}</span>
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono bg-gray-900 px-2 py-1 rounded">ID: {game._id}</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate(`/game/${game._id}`)}
                                            className="flex-1 bg-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
                                        >
                                            Resume
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingId(game._id);
                                                setEditingName(game.name);
                                            }}
                                            className="bg-yellow-600 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                                        >
                                            Rename
                                        </button>
                                        <button
                                            onClick={() => handleDelete(game._id, game.name)}
                                            className="bg-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-500 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Join as Crowd */}
                <div className="mt-12 bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">Join Someone Else's Game</h3>
                    <Link to="/" className="text-yellow-500 hover:text-yellow-400 font-semibold">
                        Go to Home to join as Crowd →
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
