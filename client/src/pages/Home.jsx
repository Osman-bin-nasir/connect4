import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_URL from '../config';

function Home() {
    const [selectedTime, setSelectedTime] = useState(30);
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [popularGames, setPopularGames] = useState({ mostLoved: [], mostPlayed: [] });
    const [activeTab, setActiveTab] = useState('loved'); // 'loved' or 'played'
    const navigate = useNavigate();

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);
        setIsLoggedIn(!!id);
        fetchLeaderboard();
        fetchPopularGames();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/games/leaderboard`);
            setLeaderboard(res.data);
        } catch (err) {
            console.error('Failed to fetch leaderboard', err);
        }
    };

    const fetchPopularGames = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/games/popular`);
            setPopularGames(res.data);
        } catch (err) {
            console.error('Failed to fetch popular games', err);
        }
    };

    const handleHeartClick = async (gameId, isHearted) => {
        if (!isLoggedIn) {
            toast.error('Please log in or create an account to heart a game', {
                duration: 4000,
                icon: '💔'
            });
            return;
        }

        try {
            if (isHearted) {
                // Unheart
                await axios.delete(`${API_URL}/api/games/${gameId}/heart`, {
                    data: { userId }
                });
                toast.success('Removed from favorites');
            } else {
                // Heart
                await axios.post(`${API_URL}/api/games/${gameId}/heart`, { userId });
                toast.success('Added to favorites!', { icon: '❤️' });
            }
            // Refresh popular games to update heart counts
            fetchPopularGames();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update heart');
        }
    };

    const handleJoinAsCrowd = () => {
        if (!gameIdInput.trim()) {
            toast.error('Please enter a Game ID');
            return;
        }
        navigate(`/game/${gameIdInput}`);
    };

    const handleLoginRedirect = () => {
        navigate('/login');
    };

    const renderGameCard = (game) => {
        const isHearted = game.hearts && userId && game.hearts.includes(userId);
        const creatorName = game.singlePlayerId?.username || 'Anonymous';

        return (
            <div
                key={game._id}
                className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-xl border border-gray-700 hover:border-yellow-500/50 transition-all group cursor-pointer"
            >
                <div className="flex justify-between items-start mb-3">
                    <div
                        className="flex-1"
                        onClick={() => navigate(`/game/${game._id}`)}
                    >
                        <h3 className="text-xl font-bold text-yellow-400 mb-1 group-hover:text-yellow-300 transition-colors">
                            {game.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                            by <span className="text-gray-300">{creatorName}</span>
                        </p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleHeartClick(game._id, isHearted);
                        }}
                        className={`text-2xl transition-transform hover:scale-110 ${isHearted ? 'animate-pulse' : ''
                            }`}
                        title={isLoggedIn ? (isHearted ? 'Unheart' : 'Heart this game') : 'Login to heart'}
                    >
                        {isHearted ? '❤️' : '🤍'}
                    </button>
                </div>

                <div
                    className="flex items-center justify-between text-sm"
                    onClick={() => navigate(`/game/${game._id}`)}
                >
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-red-400">
                            <span>❤️</span>
                            <span className="font-semibold">{game.heartCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1 text-blue-400">
                            <span>👥</span>
                            <span className="font-semibold">{game.playerCount || 0}</span>
                        </span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${game.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        game.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        {game.status}
                    </span>
                </div>
            </div>
        );
    };

    const displayGames = activeTab === 'loved' ? popularGames.mostLoved : popularGames.mostPlayed;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-12 font-sans px-4">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-12 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500 text-center">
                1 vs The Crowd
            </h1>
            <div className="flex flex-col gap-6 items-center mb-16">
                {isLoggedIn ? (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        Go to Dashboard
                    </button>
                ) : (
                    <button
                        onClick={handleLoginRedirect}
                        className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        Login to Play as The One
                    </button>
                )}

                <div className="flex gap-2 items-center mt-8 bg-gray-800 p-4 rounded-xl">
                    <input
                        type="text"
                        value={gameIdInput}
                        onChange={(e) => setGameIdInput(e.target.value)}
                        placeholder="Enter Game ID"
                        className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button
                        onClick={handleJoinAsCrowd}
                        className="bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                    >
                        Join as Crowd
                    </button>
                </div>

                {!isLoggedIn && (
                    <p className="text-gray-500 mt-4">
                        Don't have an account?{' '}
                        <span
                            onClick={() => navigate('/signup')}
                            className="text-yellow-500 hover:text-yellow-400 font-semibold cursor-pointer"
                        >
                            Sign up
                        </span>
                    </p>
                )}
            </div>

            {/* Popular Games Section */}
            <div className="w-full max-w-6xl mb-20">
                <h2 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-3">
                    <span className="text-yellow-400">🔥</span> Trending Games
                </h2>

                {/* Tabs */}
                <div className="flex justify-center gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab('loved')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'loved'
                            ? 'bg-gradient-to-r from-red-600 to-pink-600 shadow-lg shadow-red-500/30'
                            : 'bg-gray-800 hover:bg-gray-700'
                            }`}
                    >
                        ❤️ Most Loved
                    </button>
                    <button
                        onClick={() => setActiveTab('played')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'played'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30'
                            : 'bg-gray-800 hover:bg-gray-700'
                            }`}
                    >
                        🎮 Most Played
                    </button>
                </div>

                {/* Games Grid */}
                {displayGames && displayGames.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayGames.slice(0, 6).map(renderGameCard)}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 bg-gray-800/30 p-12 rounded-xl backdrop-blur-sm border border-gray-800">
                        <p>No games yet. Be the first to create one!</p>
                    </div>
                )}
            </div>

            {/* Hall of Fame Section */}
            <div className="w-full max-w-4xl">
                <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                    <span className="text-yellow-400">🏆</span> Hall of Fame
                </h2>

                {leaderboard.length === 0 ? (
                    <div className="text-center text-gray-500 bg-gray-800/30 p-8 rounded-xl backdrop-blur-sm border border-gray-800">
                        <p>No champions yet. Will you be the first?</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 w-full">
                        {leaderboard.map((player, index) => {
                            // Rank Styles
                            const isFirst = index === 0;
                            const isSecond = index === 1;
                            const isThird = index === 2;

                            const rankColor = isFirst ? 'text-yellow-400' :
                                isSecond ? 'text-gray-300' :
                                    isThird ? 'text-orange-400' : 'text-gray-500';

                            const borderColor = isFirst ? 'border-yellow-500/50 hover:border-yellow-400' :
                                isSecond ? 'border-gray-500/50 hover:border-gray-300' :
                                    isThird ? 'border-orange-500/50 hover:border-orange-400' :
                                        'border-gray-800 hover:border-gray-600';

                            const bgGradient = isFirst ? 'bg-gradient-to-r from-yellow-900/20 to-gray-800' :
                                isSecond ? 'bg-gradient-to-r from-gray-800 to-gray-800' :
                                    isThird ? 'bg-gradient-to-r from-orange-900/20 to-gray-800' :
                                        'bg-gray-800/40';

                            const glow = isFirst ? 'shadow-[0_0_15px_rgba(234,179,8,0.2)]' : '';

                            return (
                                <div
                                    key={player._id}
                                    className={`
                                        relative flex items-center justify-between p-4 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:bg-gray-700/60
                                        ${borderColor} ${bgGradient} ${glow} backdrop-blur-md
                                    `}
                                >
                                    {/* Left: Rank & Name */}
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className={`
                                            font-mono text-xl md:text-2xl font-bold w-12 text-center
                                            ${rankColor}
                                        `}>
                                            #{index + 1}
                                        </div>

                                        <div className="flex flex-col">
                                            <span className={`
                                                font-bold text-lg md:text-xl text-white
                                                ${isFirst ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : ''}
                                            `}>
                                                {player.username}
                                            </span>
                                            {isFirst && <span className="text-xs text-yellow-500 font-bold tracking-wider uppercase">Champion</span>}
                                        </div>
                                    </div>

                                    {/* Right: Wins */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🏆</span>
                                        <span className={`font-mono font-bold text-xl md:text-2xl ${rankColor}`}>
                                            {player.wins}
                                        </span>
                                    </div>

                                    {/* Subtle Glow Effect on Hover (Pseudo-element handled via Tailwind group/hover if needed, but simple bg change works well) */}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Home;
