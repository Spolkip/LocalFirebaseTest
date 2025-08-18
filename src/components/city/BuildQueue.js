import React, { useState, useEffect, useRef } from 'react';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
const buildingImages = {};
const contexts = [
    require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/)
];
contexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        buildingImages[key] = context(item);
    });
});
const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};
const QueueItem = ({ item, isFirst, onCancel, isLast, onHover, onLeave, hoveredItem }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    useEffect(() => {
        if (!isFirst) return;
        const calculateTimeLeft = () => {
            const endTime = (item.endTime instanceof Date) ? item.endTime : new Date(item.endTime);
            if (isNaN(endTime.getTime())) {
                setTimeLeft(0);
                return;
            }
            const remaining = Math.max(0, endTime.getTime() - Date.now());
            setTimeLeft(remaining / 1000);
        };
        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, [item.endTime, isFirst]);
    const building = item.isSpecial
        ? specialBuildingsConfig[item.buildingId]
        : buildingConfig[item.buildingId];
    if (!building) return null;
    const imageSrc = buildingImages[building.image];
    const isDemolition = item.type === 'demolish';
    const title = isDemolition
        ? `Demolish ${building.name} to Lvl ${item.level}`
        : `${building.name} (Level ${item.level})`;
    const levelText = isDemolition ? ` Lvl ${item.level}` : `^${item.level}`;
    return (
        <div
            className={`relative w-16 h-16 bg-gray-700 border-2 rounded-md flex-shrink-0 ${isDemolition ? 'border-red-500' : 'border-gray-600'}`}
            title={title}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={onLeave}
        >
            <img src={imageSrc} alt={building.name} className="w-full h-full object-contain p-1" />
             <span className={`absolute top-0 right-0 text-black text-xs font-bold px-1 rounded-bl-md z-10 ${isDemolition ? 'bg-red-500 text-white' : 'bg-yellow-500'}`}>
                {levelText}
            </span>
            {isFirst && (
                <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-red-500 text-xs text-center py-0.5 font-mono">
                    {formatTime(timeLeft)}
                </span>
            )}
            {isLast && (
                <button
                    onClick={onCancel}
                    className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full font-bold text-xs hover:bg-red-500 transition-colors z-10"
                    title="Cancel Construction"
                >
                    &times;
                </button>
            )}
            {hoveredItem === item.id && (
                 <div className="unit-tooltip" style={{ top: '50%', left: '100%', transform: 'translate(10px, -50%)', zIndex: 100, width: '200px', pointerEvents: 'none' }}>
                    <div className="tooltip-header"><h3 className="tooltip-title">{building.name}</h3></div>
                    <div className="tooltip-body" style={{ padding: '0.5rem' }}>
                        <p className="tooltip-description" style={{ fontSize: '0.75rem' }}>{building.description}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
const BuildQueue = ({ buildQueue, onCancel }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const tooltipTimeoutRef = useRef(null);
    const queueCapacity = 5;
    const emptySlots = Array(Math.max(0, queueCapacity - (buildQueue?.length || 0))).fill(null);
    const handleMouseEnter = (itemId) => {
        clearTimeout(tooltipTimeoutRef.current);
        setHoveredItem(itemId);
    };
    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 200);
    };
    return (
        <div className="bg-gray-900 p-2 rounded-lg mb-4 flex items-center gap-3 border border-gray-700">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-4xl flex-shrink-0" title="Construction">
                🔨
            </div>
            <div className="flex-grow flex items-center gap-3">
                {buildQueue && buildQueue.map((item, index) => (
                    <QueueItem
                        key={item.id || `${item.buildingId}-${index}`}
                        item={item}
                        isFirst={index === 0}
                        isLast={index === buildQueue.length - 1}
                        onCancel={() => onCancel(item)}
                        onHover={handleMouseEnter}
                        onLeave={handleMouseLeave}
                        hoveredItem={hoveredItem}
                    />
                ))}
                {emptySlots.map((_, index) => (
                    <div key={`empty-${index}`} className="w-16 h-16 bg-gray-800 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center flex-shrink-0">
                        <img src={buildingImages['temple.png']} alt="Empty Slot" className="w-10 h-10 opacity-20" />
                    </div>
                ))}
            </div>
        </div>
    );
};
export default BuildQueue;
