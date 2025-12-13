import React from 'react';
import Cell from './Cell';

const Board = ({ board, onColumnClick, votes }) => {
    return (
        <div className="bg-blue-800 p-2 md:p-4 rounded-xl shadow-2xl border-2 md:border-4 border-blue-900 inline-block max-w-[95vw]">
            <div className="flex flex-col gap-1 md:gap-2">
                {board.map((row, rIndex) => (
                    <div key={rIndex} className="flex gap-1 md:gap-2">
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

            {/* Vote counts (if crowd) */}
            {votes && (
                <div className="flex gap-2 mt-2 justify-between px-2">
                    {Array(7).fill(0).map((_, i) => (
                        <div key={i} className="w-12 text-center text-white font-bold text-sm bg-black/30 rounded py-1">
                            {votes[i] || 0}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Board;
