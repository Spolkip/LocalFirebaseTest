// src/components/city/DivinePowers.js
import React from 'react';
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

    if (!godDetails) {
        return null;
    }

    const availablePowers = godDetails.powers.filter(power => {
        return power.effect.target === targetType || power.effect.target === 'both';
    });

    const content = (
        <div className={isMenu ? "divine-powers-menu-content" : "divine-powers-modal-content"} onClick={e => e.stopPropagation()}>
            <div className="divine-powers-header">
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
