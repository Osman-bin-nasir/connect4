import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

function Home() {
    const [selectedTime, setSelectedTime] = useState(30);
    const [gameIdInput, setGameIdInput] = useState('');
    const navigate = useNavigate();

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
                <button
                    onClick={handleLoginRedirect}
                    className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                >
                    Login to Play as The One
                </button>

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

                <p className="text-gray-500 mt-4">
                    Don't have an account?{' '}
                    <span
                        onClick={() => navigate('/signup')}
                        className="text-yellow-500 hover:text-yellow-400 font-semibold cursor-pointer"
                    >
                        Sign up
                    </span>
                </p>
            </div>
        </div>
    );
}

export default Home;
