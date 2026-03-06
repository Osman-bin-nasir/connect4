import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { User, Mail, Lock, CheckCircle2, Home } from 'lucide-react';
import API_URL from '../config';

function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isLoading) return;

        if (!username || !email || !password || !confirmPassword) {
            toast.error('Please fill in all fields', { style: { background: '#334155', color: '#fff' } });
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match', { style: { background: '#334155', color: '#fff' } });
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters', { style: { background: '#334155', color: '#fff' } });
            return;
        }

        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/signup`, {
                username,
                email,
                password
            });

            // Auto login
            const { user, token } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userId', user._id);
            localStorage.setItem('username', user.username);
            localStorage.setItem('email', user.email);
            localStorage.setItem('isGuest', 'false');

            toast.success('Account created! Welcome to the arena.', { icon: '🎉', style: { background: '#334155', color: '#fff' } });
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Signup failed', { style: { background: '#ef4444', color: '#fff' } });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-16 pb-12 px-4 relative flex items-center justify-center overflow-hidden">

            {/* Background elements */}
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float"></div>
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md z-10"
            >
                {/* Back to Home Link */}
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group">
                    <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="text-sm font-medium">Back to Home</span>
                </Link>

                <div className="glass-panel p-8 md:p-10 rounded-3xl relative overflow-hidden backdrop-blur-xl border border-slate-700/50 shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-black mb-2 text-white">
                            Create Account
                        </h1>
                        <p className="text-slate-400 text-sm">Join the community and start playing</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 ml-1 uppercase tracking-wider">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-slate-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-600 text-sm"
                                    placeholder="Choose a username"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 ml-1 uppercase tracking-wider">Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-slate-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-600 text-sm"
                                    placeholder="your@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 ml-1 uppercase tracking-wider">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-slate-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-600 text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 ml-1 uppercase tracking-wider">Confirm Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-slate-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-600 text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full mt-6 bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'Creating Account...' : (
                                <>Sign Up <CheckCircle2 className="w-5 h-5" /></>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
                        <p className="text-slate-400 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default Signup;
