// src/components/city/SpecialBuildingMenu.js
import React from 'react';
import specialBuildings from '../../gameData/specialBuildings.json';
import './SpecialBuildingMenu.css';

const buildingImages = {};
// #comment Update the image context to look in the special_buildings folder
const imageContext = require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    buildingImages[key] = imageContext(item);
});

const SpecialBuildingMenu = ({ onBuild, onClose, cityGameState, availablePopulation }) => {
    const cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
    const canAfford = cityGameState.resources.wood >= cost.wood &&
                      cityGameState.resources.stone >= cost.stone &&
                      cityGameState.resources.silver >= cost.silver &&
                      availablePopulation >= cost.population;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="special-building-menu-container" onClick={e => e.stopPropagation()}>
                <div className="special-building-header">
                    <h3>Construct a Wonder</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="p-2 text-center bg-amber-200 border-b-2 border-amber-400">
                    <p className="font-bold">Cost: {cost.wood} Wood, {cost.stone} Stone, {cost.silver} Silver, {cost.population} Population</p>
                    <p className="text-sm italic">You may only construct one special building per city.</p>
                </div>
                <div className="special-building-grid">
                    {Object.entries(specialBuildings).map(([id, building]) => (
                        <div key={id} className="special-building-card">
                            <img src={buildingImages[building.image]} alt={building.name} />
                            <h4>{building.name}</h4>
                            <p>{building.description}</p>
                            <button
                                onClick={() => onBuild(id, cost)}
                                disabled={!canAfford}
                                className="special-build-btn"
                            >
                                Build
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SpecialBuildingMenu;
