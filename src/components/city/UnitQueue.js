// src/components/city/UnitQueue.js
import React, { useState, useEffect, useRef } from 'react';
import unitConfig from '../../gameData/units.json';
import './UnitQueue.css'; // Import the new CSS

// Dynamically import all unit images
const unitImages = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const UnitQueueItem = ({ item, onCancel, isFirst, isLast, onHover, onLeave }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const itemRef = useRef(null);

    useEffect(() => {
        if (!isFirst) return;

        let interval; // #comment define interval inside useEffect
        const calculateTimeLeft = () => {
            const endTime = (item.endTime instanceof Date) ? item.endTime : new Date(item.endTime);
            if (isNaN(endTime.getTime())) {
                setTimeLeft(0);
                return;
            }
            const remaining = Math.max(0, (endTime.getTime() - Date.now()) / 1000);
            setTimeLeft(remaining);
            
            if (remaining <= 0) {
                clearInterval(interval);
            }
        };

        calculateTimeLeft();
        interval = setInterval(calculateTimeLeft, 1000); // #comment assign interval here
        return () => clearInterval(interval);
    }, [item.endTime, isFirst]);

    const unit = unitConfig[item.unitId];
    if (!unit) return null;
    const imageSrc = unitImages[unit.image];

    return (
        <div 
            ref={itemRef}
            className="relative w-16 h-16 bg-gray-700 border-2 border-gray-600 rounded-md flex-shrink-0" 
            title={`${item.amount}x ${unit.name}`}
            onMouseEnter={() => onHover(item, itemRef.current)}
            onMouseLeave={onLeave}
        >
            <img src={imageSrc} alt={unit.name} className="w-full h-full object-contain p-1" />
            <span className="absolute bottom-0 right-1 text-white bg-black bg-opacity-75 px-1.5 py-0.5 text-xs font-bold rounded-tl-md rounded-br-md">
                {item.amount}
            </span>
            {isFirst && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs text-center py-0.5 font-mono">
                    {formatTime(timeLeft)}
                </div>
            )}
            {isLast && (
                <button
                    onClick={() => onCancel(item)} // Pass the entire item object
                    className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full font-bold text-xs hover:bg-red-500 transition-colors z-10"
                    title="Cancel"
                >
                    &times;
                </button>
            )}
        </div>
    );
};

const UnitQueue = ({ unitQueue, onCancel, title = "In Training" }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const [tooltipStyle, setTooltipStyle] = useState({ display: 'none' });
    const tooltipTimeoutRef = useRef(null);
    const queueContainerRef = useRef(null);

    // #comment handle mouse enter to show tooltip and calculate its position
    const handleMouseEnter = (item, element) => {
        clearTimeout(tooltipTimeoutRef.current);
        if (element && queueContainerRef.current) {
            const queueRect = queueContainerRef.current.getBoundingClientRect();
            const itemRect = element.getBoundingClientRect();

            setTooltipStyle({
                position: 'absolute',
                bottom: `${queueRect.height}px`, // Position above the queue container
                left: `${itemRect.left - queueRect.left + (itemRect.width / 2)}px`,
                transform: 'translateX(-50%)',
                marginBottom: '8px',
            });
            setHoveredItem(item);
        }
    };

    // #comment handle mouse leave to hide tooltip
    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 200);
    };
    
    // #comment Get the completion time of the last item in the queue
    const totalCompletionTime = unitQueue && unitQueue.length > 0 
        ? unitQueue[unitQueue.length - 1].endTime 
        : null;

    const renderTooltip = () => {
        if (!hoveredItem) return null;
        const unit = unitConfig[hoveredItem.unitId];
        const totalCompletionTimeString = totalCompletionTime ? new Date(totalCompletionTime).toLocaleTimeString() : 'Queued';

        return (
            <div className="unit-queue-tooltip" style={tooltipStyle}>
                <h3 className="unit-tooltip-title">{hoveredItem.amount}x {unit.name}</h3>
                <dl className="unit-tooltip-info">
                    <dt>Time per unit:</dt>
                    <dd>{formatTime(unit.cost.time)}</dd>
                    <dt>Queue Completion:</dt>
                    <dd>{totalCompletionTimeString}</dd>
                </dl>

            </div>
        );
    };

    if (!unitQueue || unitQueue.length === 0) {
        return (
            <div className="mt-auto pt-4">
                <h4 className="text-lg font-semibold text-yellow-400 mb-2">{title} (0/5)</h4>
                <div className="flex space-x-3 bg-gray-900 p-2 rounded-lg h-24 items-center justify-center">
                    <p className="text-gray-500">Queue is empty.</p>
                </div>
            </div>
        );
    }
    return (
        <div className="mt-auto pt-4 relative" ref={queueContainerRef}>
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">{title} ({unitQueue.length}/5)</h4>
            <div className="flex space-x-3 bg-gray-900 p-2 rounded-lg overflow-x-auto h-24 items-center">
                {unitQueue.map((item, index) => (
                    <UnitQueueItem 
                        key={item.id || `${item.unitId}-${index}`}
                        item={item} 
                        onCancel={onCancel} 
                        isFirst={index === 0}
                        isLast={index === unitQueue.length - 1}
                        onHover={handleMouseEnter}
                        onLeave={handleMouseLeave}
                    />
                ))}
            </div>
            {renderTooltip()}
        </div>
    );
};

export default UnitQueue;
