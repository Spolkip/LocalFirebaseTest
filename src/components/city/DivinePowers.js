// src/components/city/DivinePowers.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import godsConfig from '../../gameData/gods.json';
import './DivinePowers.css';

const DivinePowers = ({ godName, playerReligion, favor, onCastSpell, onClose, targetType = 'self', isMenu = false }) => {
    const getGodDetails = (name, religion) => {
        if (!name || !religion) return null;
        const religionKey = religion.toLowerCase();
        const pantheon = godsConfig[religionKey];
        if (!pantheon) return null;
        return Object.values(pantheon).find(g => g.name === name);
    };

    const godDetails = getGodDetails(godName, playerReligion);

    const divinePowersRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 600) / 2,
        y: (window.innerHeight - 700) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('divine-powers-header') || e.target.parentElement.classList.contains('divine-powers-header')) {
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

    if (!godDetails) {
        return null;
    }

    const availablePowers = godDetails.powers.filter(power => {
        return power.effect.target === targetType || power.effect.target === 'both';
    });

    const content = (
        <div 
            ref={divinePowersRef}
            className={isMenu ? "divine-powers-menu-content" : "divine-powers-modal-content"}
            onClick={e => e.stopPropagation()}
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
        >
            <div className="divine-powers-header" onMouseDown={handleMouseDown}>
                <h2>{godDetails.name}'s Powers</h2>
                <button onClick={onClose} className="close-button">&times;</button>
            </div>
            {availablePowers.length > 0 ? (
                <div className="powers-grid">
                    {availablePowers.map(power => (
                        <div key={power.name} className="power-card">
                            <h3>{power.name}</h3>
                            <p>{power.description}</p>
                            <div className="power-cost">
                                Cost: {power.favorCost} Favor
                            </div>
                            <button
                                onClick={() => onCastSpell(power)}
                                disabled={favor < power.favorCost}
                                className="cast-spell-button"
                            >
                                Cast Spell
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-center">No {targetType === 'self' ? 'self-targeted' : 'targeted'} spells available for {godDetails.name}.</p>
            )}
        </div>
    );

    if (isMenu) {
        return content;
    }

    return (
        <div className="divine-powers-modal-overlay" onClick={onClose}>
            {content}
        </div>
    );
};

export default DivinePowers;
