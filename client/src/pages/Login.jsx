import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Home, Eye, EyeOff } from 'lucide-react';
import API_URL from '../config';

function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!identifier || !password) {
            toast.error('Please fill in all fields', { style: { background: '#334155', color: '#fff' } });
            return;
        }

        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, {
                identifier,
                password
            });

            // Store user data
            const { user, token } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userId', user._id);
            localStorage.setItem('username', user.username);
            localStorage.setItem('email', user.email);
            localStorage.setItem('isGuest', 'false');

            toast.success('Welcome back!', { icon: '👋', style: { background: '#334155', color: '#fff' } });
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed', { style: { background: '#ef4444', color: '#fff' } });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-20 pb-12 px-4 relative flex items-center justify-center overflow-hidden">

            {/* Background elements */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float"></div>
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-rose-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md z-10"
            >
                {/* Back to Home Link */}
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group">
                    <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="text-sm font-medium">Back to Home</span>
                </Link>

                <div className="glass-panel p-8 md:p-10 rounded-3xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>

                    <div className="mb-10 text-center">
                        <h1 className="text-3xl md:text-4xl font-black mb-3 text-white">
                            Welcome Back
                        </h1>
                        <p className="text-slate-400 font-medium">Log in to enter the arena</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-300 ml-1">Email or Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-11 pr-4 py-3.5 rounded-xl border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Enter your email or username"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-300 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-11 pr-12 py-3.5 rounded-xl border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full mt-4 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-xl font-bold text-lg text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'Authenticating...' : (
                                <>Sign In <ArrowRight className="w-5 h-5" /></>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
                        <p className="text-slate-400">
                            New challenger?{' '}
                            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                                Create an account
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default Login;
