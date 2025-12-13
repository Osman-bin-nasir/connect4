import React from 'react';

const Cell = ({ value, onClick }) => {
    // value: 0 (empty), 1 (player), 2 (crowd)
    let color = 'bg-gray-800'; // Empty slot color
    if (value === 1) color = 'bg-red-500';
    if (value === 2) color = 'bg-yellow-500';

    return (
        <div
            className="w-8 h-8 md:w-12 md:h-12 bg-blue-700 flex items-center justify-center cursor-pointer"
            onClick={onClick}
        >
            <div className={`w-6 h-6 md:w-10 md:h-10 rounded-full ${color} transition-all duration-300 shadow-inner`}></div>
        </div>
    );
};

export default Cell;
