import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_URL from '../config';

import { Heart, Trophy } from 'lucide-react';

function Home() {
    const [selectedTime, setSelectedTime] = useState(30);
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [popularGames, setPopularGames] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);
        setIsLoggedIn(!!id);

        const fetchData = async () => {
            setIsLoading(true);
            await Promise.all([fetchLeaderboard(), fetchPopularGames()]);
            setIsLoading(false);
        };
        fetchData();
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
                        className={`transition-transform hover:scale-110 p-2 rounded-full hover:bg-white/5 ${isHearted ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-gray-400 hover:text-red-400'
                            }`}
                        title={isLoggedIn ? (isHearted ? 'Unheart' : 'Heart this game') : 'Login to heart'}
                    >
                        <Heart className={`w-6 h-6 ${isHearted ? 'fill-red-500' : ''}`} />
                    </button>
                </div>

                <div
                    className="flex items-center justify-between text-sm"
                    onClick={() => navigate(`/game/${game._id}`)}
                >
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-red-400 font-semibold">
                            <Heart className="w-4 h-4 fill-red-400" />
                            <span>{game.heartCount || 0}</span>
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


    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-12 font-sans px-4">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-12 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500 text-center drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">
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

                <div className="flex gap-2 items-center mt-8 bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
                    <input
                        type="text"
                        value={gameIdInput}
                        onChange={(e) => setGameIdInput(e.target.value)}
                        placeholder="Enter Game ID"
                        className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400"
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

            {/* Dashboard Content: Side-by-Side on Large Screens */}
            <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 lg:gap-12 lg:items-start">

                {/* Popular Games Section (Left/Main) */}
                <div className="w-full lg:flex-[2]">
                    <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                        <Heart className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">Most Loved Games</span>
                    </h2>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="bg-gray-800/40 p-5 rounded-xl border border-gray-700 h-32 animate-pulse">
                                    <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                                    <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    ) : popularGames && popularGames.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                            {popularGames.slice(0, 6).map(renderGameCard)}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 bg-gray-800/40 p-12 rounded-xl backdrop-blur-sm border border-gray-800">
                            <Heart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-lg">No hearted games yet.</p>
                            <p className="text-sm text-gray-500 mt-2">Be the first to create and love a game!</p>
                        </div>
                    )}
                </div>

                {/* Hall of Fame Section (Right/Side) */}
                <div className="w-full lg:flex-1">
                    <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">Hall of Fame</span>
                    </h2>

                    {isLoading ? (
                        <div className="flex flex-col gap-3 w-full">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="bg-gray-800/40 p-4 rounded-xl border border-gray-700 h-20 animate-pulse"></div>
                            ))}
                        </div>
                    ) : leaderboard.length === 0 ? (
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
                                            <Trophy className={`w-6 h-6 ${isFirst ? 'text-yellow-400 fill-yellow-400' : isSecond ? 'text-gray-300 fill-gray-300' : isThird ? 'text-orange-400 fill-orange-400' : 'text-gray-500'}`} />
                                            <span className={`font-mono font-bold text-xl md:text-2xl ${rankColor}`}>
                                                {player.wins}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Home;
