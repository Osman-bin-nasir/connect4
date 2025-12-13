import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!username || !email || !password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password should be at least 6 characters');
            return;
        }

        try {
            const res = await axios.post('http://localhost:3001/api/auth/signup', {
                username,
                email,
                password
            });

            toast.success('Account created successfully!');

            // Auto login
            localStorage.setItem('userId', res.data._id);
            localStorage.setItem('username', res.data.username);
            localStorage.setItem('email', res.data.email);
            localStorage.setItem('isGuest', 'false');

            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Signup failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans px-4">
            <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <h1 className="text-3xl md:text-4xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500">
                    Sign Up
                </h1>
                <p className="text-gray-400 mb-8">Join 1 vs The Crowd</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
                            placeholder="YourUsername"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-red-600 to-red-500 px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                    >
                        Create Account
                    </button>
                </form>

                <p className="text-center mt-6 text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-yellow-500 hover:text-yellow-400 font-semibold">
                        Login
                    </Link>
                </p>

                <p className="text-center mt-4 text-gray-500">
                    <Link to="/" className="hover:text-gray-400">
                        ← Back to Home
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Signup;
