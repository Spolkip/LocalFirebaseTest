// src/components/map/ScoutPanel.js
import React from 'react';

const ScoutPanel = ({ selectedResources, gameState, handleResourceChange }) => {
    const availableCaveSilver = gameState.cave?.silver || 0;

    return (
        <div className="unit-selection-section space-y-2">
            <h4 className="font-bold text-lg text-yellow-700 mb-2">Silver for Espionage</h4>
            <div className="flex justify-between items-center">
                <span className="capitalize">Silver in Cave ({Math.floor(availableCaveSilver)})</span>
                <input
                    type="number"
                    value={selectedResources.silver || 0}
                    onChange={(e) => handleResourceChange('silver', e.target.value)}
                    className="bg-white/50 border border-yellow-800/50 p-1 rounded text-gray-800 w-32"
                />
            </div>
        </div>
    );
};

export default ScoutPanel;
