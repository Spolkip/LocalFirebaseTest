// src/components/map/TradePanel.js
import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const TradePanel = ({ selectedResources, currentResources, handleResourceChange }) => {
    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };


    return (
        <div className="unit-selection-section space-y-2">
            <h4 className="font-bold text-lg text-yellow-700 mb-2">Select Resources</h4>
            <div className="flex justify-around items-end w-full">
                {Object.keys(selectedResources).map(resource =>
                    <div key={resource} className="flex flex-col items-center">
                        <img
                            src={resourceImages[resource]}
                            alt={resource}
                            className="w-12 h-12 mb-1 bg-black/10 rounded"
                        />
                        <input
                            type="number"
                            value={selectedResources[resource] || 0}
                            onChange={(e) => handleResourceChange(resource, e.target.value)}
                            className="bg-white/50 border border-yellow-800/50 p-1 rounded text-gray-800 text-center w-20 hide-number-spinners"
                            min="0"
                            max={currentResources[resource]}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradePanel;
