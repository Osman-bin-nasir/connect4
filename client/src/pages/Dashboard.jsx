import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_URL from '../config';

function Dashboard() {
    const [games, setGames] = useState([]);
    const [username, setUsername] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newGameName, setNewGameName] = useState('');
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
                userId,
                isPublic
            });

            toast.success('Game created!');
            setIsCreating(false);
            setNewGameName('');
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

                {/* Create Game Form */}
                {isCreating && (
                    <div className="mb-8 bg-gray-800 p-6 rounded-xl border-2 border-yellow-500/30">
                        <h2 className="text-2xl font-bold mb-4">Create New Game</h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Game Name</label>
                            <input
                                type="text"
                                value={newGameName}
                                onChange={(e) => setNewGameName(e.target.value)}
                                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
                                placeholder="My Epic Game"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Turn Duration</label>
                            <div className="flex gap-4">
                                {[10, 30, 60, 0].map((time) => (
                                    <button
                                        key={time}
                                        onClick={() => setSelectedTime(time)}
                                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${selectedTime === time ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-300'
                                            }`}
                                    >
                                        {time === 0 ? 'Infinite' : `${time}s`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Visibility</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsPublic(true)}
                                    className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all ${isPublic
                                        ? 'bg-green-500 text-black border-2 border-green-400'
                                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <span>🌐</span>
                                        <span>Public</span>
                                    </div>
                                    <p className="text-xs mt-1 opacity-75">Visible to everyone</p>
                                </button>
                                <button
                                    onClick={() => setIsPublic(false)}
                                    className={`flex-1 px-4 py-3 rounded-lg font-bold transition-all ${!isPublic
                                        ? 'bg-blue-500 text-black border-2 border-blue-400'
                                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <span>🔒</span>
                                        <span>Private</span>
                                    </div>
                                    <p className="text-xs mt-1 opacity-75">Only via direct link</p>
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCreateGame}
                                className="bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-500 transition-colors"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewGameName('');
                                }}
                                className="bg-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                            >
                                Cancel
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
                                            <span className={`text-sm px-2 py-1 rounded ${game.isPublic !== false ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {game.isPublic !== false ? '🌐 Public' : '🔒 Private'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-2 text-sm text-gray-400 mb-4">
                                        <p>Status: <span className="capitalize font-semibold">{game.status}</span></p>
                                        <p>Turn: <span className="font-semibold">{game.currentTurn === 'player' ? username : 'The Crowd'}</span></p>
                                        {game.winner && (
                                            <p>Winner: <span className="text-green-400 font-semibold">{game.winner === 'player' ? username : 'The Crowd'}</span></p>
                                        )}
                                        <div className="flex gap-4 mt-2">
                                            <span className="flex items-center gap-1">
                                                <span>❤️</span>
                                                <span className="font-semibold text-red-400">{game.hearts?.length || 0}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span>🎮</span>
                                                <span className="font-semibold text-blue-400">{game.plays || 0}</span>
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
