import React from 'react';
import { Users, Bot, UserCircle2 } from 'lucide-react';

/**
 * GameModeSelector - Component for selecting game mode
 * @param {string} selectedMode - Current selected mode ('crowd', '1v1', 'ai')
 * @param {function} onModeChange - Callback when mode changes
 */
function GameModeSelector({ selectedMode, onModeChange }) {
    const modes = [
        {
            id: 'crowd',
            title: '1 vs The Crowd',
            icon: Users,
            description: 'Face thousands! The crowd votes on each move.',
            color: 'yellow'
        },
        {
            id: '1v1',
            title: '1 vs 1',
            icon: UserCircle2,
            description: 'Classic head-to-head battle with another player.',
            color: 'blue'
        },
        {
            id: 'ai',
            title: 'vs AI',
            icon: Bot,
            description: 'Test your skills against the computer.',
            color: 'blue'
        }
    ];

    const getColorClasses = (color, isSelected) => {
        const colorMap = {
            yellow: {
                selected: 'bg-yellow-500/15 border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.2)]',
                hover: 'hover:bg-yellow-500/10 hover:border-yellow-500/40',
                text: 'text-yellow-400',
                icon: 'text-yellow-500'
            },
            blue: {
                selected: 'bg-blue-500/15 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
                hover: 'hover:bg-blue-500/10 hover:border-blue-500/40',
                text: 'text-blue-400',
                icon: 'text-blue-500'
            }
        };

        return colorMap[color] || colorMap.yellow;
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-400 mb-3">
                Game Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modes.map((mode) => {
                    const isSelected = selectedMode === mode.id;
                    const colors = getColorClasses(mode.color, isSelected);
                    const Icon = mode.icon;

                    return (
                        <button
                            key={mode.id}
                            type="button"
                            onClick={() => onModeChange(mode.id)}
                            className={`
                                relative p-4 rounded-xl border-2 transition-all text-left group
                                ${isSelected
                                    ? colors.selected
                                    : `bg-gray-700/30 border-gray-600 ${colors.hover}`
                                }
                            `}
                        >
                            <div className="flex items-start gap-3 mb-2">
                                <Icon
                                    className={`w-6 h-6 mt-0.5 ${isSelected ? colors.icon : 'text-gray-400 group-hover:text-gray-300'
                                        }`}
                                />
                                <div className="flex-1">
                                    <div className={`font-bold mb-1 ${isSelected ? colors.text : 'text-gray-200 group-hover:text-white'
                                        }`}>
                                        {mode.title}
                                    </div>
                                    <p className="text-xs text-gray-400 group-hover:text-gray-300">
                                        {mode.description}
                                    </p>
                                </div>
                            </div>
                            {isSelected && (
                                <div className="absolute top-2 right-2">
                                    <div className={`w-2 h-2 rounded-full ${colors.icon.replace('text-', 'bg-')}`} />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default GameModeSelector;
