// src/components/TroopDisplay.js
import React, { useState, useEffect, useRef } from 'react';
import unitConfig from '../gameData/units.json';

// Dynamically import all images from the images and images/buildings folder
const images = {};
const imageContexts = [
    require.context('../images/troops', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/gods', false, /\.(png|jpe?g|svg)$/),
];

imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        images[key] = context(item);
    });
});

const TroopDisplay = ({ units, reinforcements, title }) => {
    const [hoveredUnit, setHoveredUnit] = useState(null);
    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const [lockCountdown, setLockCountdown] = useState(5);
    const tooltipTimeoutRef = useRef(null);
    const lockTooltipTimeoutRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isTooltipLocked && containerRef.current && !containerRef.current.contains(event.target)) {
                setIsTooltipLocked(false);
                setHoveredUnit(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTooltipLocked]);

    useEffect(() => {
        clearTimeout(lockTooltipTimeoutRef.current);
        clearInterval(countdownIntervalRef.current);
        setLockCountdown(5);

        if (hoveredUnit && !isTooltipLocked) {
            countdownIntervalRef.current = setInterval(() => {
                setLockCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            lockTooltipTimeoutRef.current = setTimeout(() => {
                setIsTooltipLocked(true);
                clearInterval(countdownIntervalRef.current);
            }, 5000);
        }

        return () => {
            clearTimeout(lockTooltipTimeoutRef.current);
            clearInterval(countdownIntervalRef.current);
        };
    }, [hoveredUnit, isTooltipLocked]);
    
    const handleMouseEnter = (unitId) => {
        if (isTooltipLocked && hoveredUnit !== unitId) {
            setIsTooltipLocked(false);
        }
        clearTimeout(tooltipTimeoutRef.current);
        setHoveredUnit(unitId);
    };

    const handleMouseLeave = () => {
        if (isTooltipLocked) return;
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredUnit(null);
        }, 300);
    };

    const handleTooltipClick = (e, unitId) => {
        e.stopPropagation();
        if (isTooltipLocked && hoveredUnit === unitId) {
            setIsTooltipLocked(false);
            setHoveredUnit(null);
        } else {
            setIsTooltipLocked(true);
            setHoveredUnit(unitId);
        }
    };

    const landUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.type === 'land' && !unitConfig[id]?.mythical);
    const navalUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.type === 'naval' && !unitConfig[id]?.mythical);
    const mythicUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.mythical);

    const hasReinforcements = reinforcements && Object.keys(reinforcements).length > 0;
    const hasUnits = landUnits.length > 0 || navalUnits.length > 0 || mythicUnits.length > 0;


    const renderUnit = ([unitId, count]) => {
        const unit = unitConfig[unitId];
        if (!unit || !unit.image) return null;

        const imageUrl = images[unit.image];
        if (!imageUrl) return null;

        return (
            <div 
                key={unitId} 
                className="troop-item" 
                onMouseEnter={() => handleMouseEnter(unitId)} 
                onClick={(e) => handleTooltipClick(e, unitId)}
            >
                <img src={imageUrl} alt={unit.name} className="troop-image" />
                <span className="troop-count">{count}</span>
            </div>
        );
    };

    const renderTooltip = () => {
        if (!hoveredUnit) return null;
        const unit = unitConfig[hoveredUnit];
        if (!unit) return null;

        const counters = unit.counters?.map(counterId => unitConfig[counterId]?.name).join(', ');

        return (
            <div className="unit-tooltip" onMouseEnter={() => clearTimeout(tooltipTimeoutRef.current)} onMouseLeave={handleMouseLeave}>
                <div className="tooltip-header">
                    <h3 className="tooltip-title">{unit.name}</h3>
                </div>
                <div className="tooltip-body">
                    <img src={images[unit.image]} alt={unit.name} className="tooltip-image" />
                    <div className="tooltip-stats">
                        <div className="stat-row"><span>⚔️ Attack</span><span>{unit.attack}</span></div>
                        <div className="stat-row"><span>🛡️ Defense</span><span>{unit.defense}</span></div>
                        <div className="stat-row"><span>🏃 Speed</span><span>{unit.speed}</span></div>
                    </div>
                    {counters && (
                        <div className="tooltip-counters">
                            <strong>Counters:</strong> {counters}
                        </div>
                    )}
                    <p className="tooltip-description">{unit.description}</p>
                </div>
                <div className="tooltip-lock-timer">
                    {isTooltipLocked ? '🔒' : lockCountdown}
                </div>
            </div>
        );
    };

    return (
        <div className="troop-display-container" ref={containerRef} onMouseLeave={handleMouseLeave}>
            {renderTooltip()}
            {landUnits.length > 0 && (
                <div className="troop-section">
                    <h4 className="troop-section-header">Units</h4>
                    <div className="troop-grid">
                        {landUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {mythicUnits.length > 0 && (
                <div className="troop-section">
                    <h4 className="troop-section-header">Mythic Units</h4>
                    <div className="troop-grid">
                        {mythicUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {navalUnits.length > 0 && (
                 <div className="troop-section">
                    <h4 className="troop-section-header">Ships</h4>
                    <div className="troop-grid">
                        {navalUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {hasReinforcements && (
                <div className="troop-section">
                    <h4 className="troop-section-header">Reinforcements</h4>
                    {Object.entries(reinforcements).map(([originCityId, reinfData]) => (
                        <div key={originCityId} className="mb-2 last:mb-0">
                            <p className="text-xs text-center font-semibold text-yellow-600">{reinfData.originCityName}</p>
                            <div className="troop-grid">
                                {Object.entries(reinfData.units || {}).map(renderUnit)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!hasUnits && !hasReinforcements && (
                 <p className="text-gray-500 text-xs text-center p-4">No troops in this city.</p>
            )}
        </div>
    );
};

export default TroopDisplay;
