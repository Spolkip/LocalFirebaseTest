// src/components/map/OwnActiveCityModal.js
import React from 'react';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';
import './OtherCityModal.css'; // Reuse styles

const OwnActiveCityModal = ({ city, onClose, onGoTo, onEnterCity, onWithdraw }) => {
    if (!city) return null;

    const handleGoTo = () => {
        if (onGoTo) {
            onGoTo(city.x, city.y);
        }
        onClose();
    };

    // #comment Check if there are any reinforcements from other cities owned by the player
    const hasReinforcements = city.reinforcements && Object.keys(city.reinforcements).length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <h3 className="font-title text-2xl">Your Active City: {city.cityName}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    <div className="info-box">
                        <TroopDisplay 
                            units={city.units} 
                            unitsData={unitsData} 
                            title="Garrison"
                            reinforcements={city.reinforcements}
                        />
                    </div>
                    <div className="action-buttons-grid">
                        <button onClick={() => onEnterCity(city.id)} className="action-btn">
                            Enter City
                        </button>
                        {/* #comment Conditionally render Withdraw button */}
                        {hasReinforcements && (
                            <button onClick={() => onWithdraw(city)} className="action-btn">
                                Withdraw Troops
                            </button>
                        )}
                        <button onClick={handleGoTo} className={`action-btn ${hasReinforcements ? '' : 'col-span-2'}`}>
                            Center on Map
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnActiveCityModal;
