// src/components/city/SpecialBuildingPanel.js
import React from 'react';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import './SpecialBuildingMenu.css'; // Reusing styles

const buildingImages = {};
const imageContext = require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    buildingImages[key] = imageContext(item);
});

const SpecialBuildingPanel = ({ buildingId, onClose, onDemolish }) => {
    const building = specialBuildingsConfig[buildingId];

    if (!building) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="special-building-menu-container text-center p-8" onClick={e => e.stopPropagation()}>
                    <p>Wonder information not found.</p>
                    <button onClick={onClose} className="btn btn-primary mt-4">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="special-building-menu-container" onClick={e => e.stopPropagation()}>
                <div className="special-building-header">
                    <h3>{building.name}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="p-4 flex flex-col items-center text-center">
                    <img src={buildingImages[building.image]} alt={building.name} className="w-32 h-32 object-contain mb-4" />
                    <p className="italic mb-4">{building.description}</p>
                    <div className="bg-amber-200 p-3 rounded w-full">
                        <h4 className="font-bold text-lg">Bonus</h4>
                        <p>{building.bonus.description}</p>
                    </div>
                    <button onClick={onDemolish} className="btn btn-danger mt-6">
                        Demolish
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SpecialBuildingPanel;
