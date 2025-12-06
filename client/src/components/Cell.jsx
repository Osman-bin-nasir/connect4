import React from 'react';

const Cell = ({ value, onClick }) => {
    // value: 0 (empty), 1 (player), 2 (crowd)
    let color = 'bg-gray-800'; // Empty slot color
    if (value === 1) color = 'bg-red-500';
    if (value === 2) color = 'bg-yellow-500';

    return (
        <div
            className="w-12 h-12 bg-blue-700 flex items-center justify-center cursor-pointer"
            onClick={onClick}
        >
            <div className={`w-10 h-10 rounded-full ${color} transition-all duration-300 shadow-inner`}></div>
        </div>
    );
};

export default Cell;
