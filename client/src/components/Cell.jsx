import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Cell = ({ value, onClick }) => {
    // value: 0 (empty), 1 (player 1/red), 2 (player 2/yellow)

    let chipClasses = "";
    if (value === 1) {
        chipClasses = "bg-red-500 border-red-600";
    } else if (value === 2) {
        chipClasses = "bg-yellow-500 border-yellow-600";
    }

    return (
        <div
            className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 relative cursor-pointer group"
            onClick={onClick}
        >
            {/* Cell Background (The Board Slot) */}
            <div className="absolute inset-0 bg-slate-900/40 rounded-full border border-slate-800/50 shadow-inner overflow-hidden">
                {/* Internal glow for empty slots on hover */}
                {value === 0 && (
                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors rounded-full rounded-full"></div>
                )}
            </div>

            {/* The Chip */}
            <AnimatePresence>
                {value !== 0 && (
                    <motion.div
                        initial={{ y: -200, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            mass: 0.8
                        }}
                        className={`absolute inset-1 sm:inset-1.5 rounded-full border-b-4 z-10 ${chipClasses}`}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Cell;
