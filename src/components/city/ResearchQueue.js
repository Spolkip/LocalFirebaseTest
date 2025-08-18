// src/components/city/ResearchQueue.js
import React, { useState, useEffect, useRef } from 'react';
import researchConfig from '../../gameData/research.json';
import './ResearchQueue.css'; // #comment Import new CSS

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const ResearchQueueItem = ({ item, onCancel, isFirst, isLast, onHover, onLeave }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const itemRef = useRef(null);

    useEffect(() => {
        if (!isFirst) return; // Only calculate time for the first item.

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

    const research = researchConfig[item.researchId];
    if (!research) return null;

    return (
        <div
            ref={itemRef}
            className="relative p-2 bg-amber-100/50 rounded flex justify-between items-center"
            onMouseEnter={() => onHover(item, itemRef.current)}
            onMouseLeave={onLeave}
        >
            <span className="font-semibold">{research.name}</span>
            <div className="flex items-center gap-4">
                {isFirst && <span className="font-mono text-gray-800 bg-white/50 px-2 py-1 rounded">{formatTime(timeLeft)}</span>}
                {isLast && (
                    <button
                        onClick={onCancel}
                        className="text-red-600 hover:text-red-500 font-bold text-xl leading-none px-2 rounded-full"
                        title="Cancel Research"
                    >
                        &times;
                    </button>
                )}
            </div>
        </div>
    );
};

const ResearchQueue = ({ researchQueue, onCancel }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const [tooltipStyle, setTooltipStyle] = useState({ display: 'none' });
    const tooltipTimeoutRef = useRef(null);
    const queueContainerRef = useRef(null);

    // #comment handle mouse enter to show tooltip and calculate its position
    const handleMouseEnter = (item, element) => {
        clearTimeout(tooltipTimeoutRef.current);
        if (element && queueContainerRef.current) {
            const itemRect = element.getBoundingClientRect();

            setTooltipStyle({
                position: 'fixed', // Use fixed to break out of the modal
                bottom: `${window.innerHeight - itemRect.top + 8}px`, // Position above the item
                left: `${itemRect.left + (itemRect.width / 2)}px`,
                transform: 'translateX(-50%)',
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
    const totalCompletionTime = researchQueue && researchQueue.length > 0
        ? researchQueue[researchQueue.length - 1].endTime
        : null;

    const renderTooltip = () => {
        if (!hoveredItem) return null;
        const research = researchConfig[hoveredItem.researchId];
        const totalCompletionTimeString = totalCompletionTime ? new Date(totalCompletionTime).toLocaleTimeString() : 'N/A';

        return (
            <div className="research-queue-tooltip" style={tooltipStyle}>
                <h3 className="research-tooltip-title">{research.name}</h3>
                <p className="text-sm mb-2">{research.description}</p>
                <dl className="research-tooltip-info">
                    <dt>Time:</dt>
                    <dd>{formatTime(research.cost.time)}</dd>
                    <dt>Queue Completion:</dt>
                    <dd>{totalCompletionTimeString}</dd>
                </dl>
            </div>
        );
    };

    if (!researchQueue || researchQueue.length === 0) {
        return (
            <div className="bg-gray-900/80 p-3 mt-auto flex-shrink-0">
                <h4 className="text-lg font-semibold text-gray-400 text-center">Research queue is empty.</h4>
            </div>
        );
    }

    return (
        <div className="bg-gray-900/80 p-3 mt-auto flex-shrink-0" ref={queueContainerRef}>
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">Research Queue ({researchQueue.length}/5)</h4>
            <div className="space-y-2">
                {researchQueue.map((item, index) => (
                    <ResearchQueueItem
                        key={`${item.researchId}-${index}`}
                        item={item}
                        onCancel={() => onCancel(index)}
                        isFirst={index === 0}
                        isLast={index === researchQueue.length - 1}
                        onHover={handleMouseEnter}
                        onLeave={handleMouseLeave}
                    />
                ))}
            </div>
            {renderTooltip()}
        </div>
    );
};

export default ResearchQueue;
