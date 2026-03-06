import React from 'react';
import Cell from './Cell';
import { motion, AnimatePresence } from 'framer-motion';

const Board = ({ board, onColumnClick, votes }) => {
    return (
        <div className="relative inline-block max-w-full">
            {/* The Board Container */}
            <div className="bg-blue-600 p-3 md:p-5 rounded-xl shadow-lg border-b-4 border-blue-800 relative z-10">

                {/* Board grid */}
                <div className="flex flex-col gap-2 md:gap-3">
                    {board.map((row, rIndex) => (
                        <div key={rIndex} className="flex gap-2 md:gap-3 justify-center">
                            {row.map((cell, cIndex) => (
                                <Cell
                                    key={`${rIndex}-${cIndex}`}
                                    value={cell}
                                    onClick={() => onColumnClick(cIndex)}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Vote indicators (for crowd mode) */}
                <AnimatePresence>
                    {votes && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-2 md:gap-3 mt-4 justify-center"
                        >
                            {Array(7).fill(0).map((_, i) => (
                                <div key={i} className="w-10 sm:w-12 md:w-16 flex justify-center">
                                    <div className="relative">
                                        <div className={`
                                            px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm font-bold shadow
                                            ${votes[i] > 0
                                                ? 'bg-yellow-500 text-black border border-yellow-600'
                                                : 'bg-blue-800 text-blue-300 border border-blue-900'}
                                            transition-all duration-300
                                        `}>
                                            {votes[i] || 0}
                                        </div>
                                        {/* Connector line pointing up to column */}
                                        {votes[i] > 0 && (
                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-yellow-500"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Board;
