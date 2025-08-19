// src/components/city/PrisonMenu.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import Countdown from '../map/Countdown';
import './PrisonMenu.css';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

/**
 * Safely converts various timestamp formats into a JS Date object.
 * This handles Firestore Timestamps (live and serialized), JS Dates, and millisecond numbers.
 * @param {object|Date|number} timestamp - The timestamp to convert.
 * @returns {Date|null} A valid Date object or null if the timestamp is invalid.
 */
const getSafeDate = (timestamp) => {
    if (!timestamp) return null;
    // Handles live Firestore Timestamp objects
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    // Handles serialized Firestore Timestamps (from JSON, etc.)
    if (timestamp.seconds && typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000);
    }
    // Handles JS Dates or millisecond numbers
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
        return date;
    }
    return null;
};

const PrisonMenu = ({ cityGameState, onClose, onReleaseHero }) => { // Added onReleaseHero prop
    const prisoners = cityGameState.prisoners || [];
    const prisonLevel = cityGameState.buildings.prison?.level || 0;
    // Capacity starts at 5 and increases by 1 per level, up to 29 at max level 25.
    const capacity = prisonLevel > 0 ? prisonLevel + 4 : 0;

    const prisonRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 500) / 2,
        y: (window.innerHeight - 700) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('prison-header') || e.target.parentElement.classList.contains('prison-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div
                ref={prisonRef}
                className="prison-menu-container"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="prison-header">
                    <h3>Prison (Level {prisonLevel})</h3>
                    <p>Capacity: {prisoners.length} / {capacity}</p>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="prison-content">
                    {prisoners.length > 0 ? (
                        prisoners.map((prisoner, index) => { // Added index for a unique key
                            const hero = heroesConfig[prisoner.heroId];
                            if (!hero) return null;
                            
                            // Duration starts at 8 hours and increases up to 3 days at max level.
                            const durationSeconds = 28800 + (prisonLevel - 1) * 9600;
                            
                            // Use the new helper function to safely get the date
                            const capturedTime = getSafeDate(prisoner.capturedAt);
                            const executionTime = capturedTime ? new Date(capturedTime.getTime() + durationSeconds * 1000) : null;

                            return (
                                // Using index in the key to ensure it's unique, preventing rendering issues.
                                <div key={`${prisoner.heroId}-${index}`} className="prisoner-item">
                                    <img src={heroImages[hero.image]} alt={hero.name} className="prisoner-avatar" />
                                    <div className="prisoner-info">
                                        <p className="prisoner-name">{hero.name}</p>
                                        <p className="prisoner-owner">Owner: {prisoner.ownerUsername}</p>
                                        {/* Display the city the hero was captured from */}
                                        <p className="prisoner-city">From: {prisoner.originCityName || 'Unknown City'}</p>
                                        <p className="execution-timer">
                                            Execution in: 
                                            {executionTime ? <Countdown arrivalTime={executionTime} /> : 'Calculating...'}
                                        </p>
                                    </div>
                                    <div className="prisoner-actions">
                                        {/* Added Release button, will call the onReleaseHero function */}
                                        <button onClick={() => onReleaseHero(prisoner)} className="release-btn">Release</button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-gray-500">The prison is empty.</p>
                    )}
                </div>
                 <div className="prison-footer">
                    <p className="text-xs italic">Heroes are executed after their timer runs out. Executed heroes can only be revived with a 'Soulstone'. If this city is conquered, all prisoners will be freed.</p>
                </div>
            </div>
        </div>
    );
};

export default PrisonMenu;
