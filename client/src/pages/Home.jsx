import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_URL from '../config';

function Home() {
    const [selectedTime, setSelectedTime] = useState(30);
    const [gameIdInput, setGameIdInput] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const userId = localStorage.getItem('userId');
        setIsLoggedIn(!!userId);
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/games/leaderboard`);
            setLeaderboard(res.data);
        } catch (err) {
            console.error('Failed to fetch leaderboard', err);
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

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans px-4">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-12 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500 text-center">
                1 vs The Crowd
            </h1>
            <div className="flex flex-col gap-6 items-center">
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

            {/* Hall of Fame Section */}
            <div className="mt-20 w-full max-w-4xl">
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
