// src/components/city/RecruitmentToolTip.js
import React from 'react';
import Countdown from '../map/Countdown';
import unitConfig from '../../gameData/units.json';
import './RecruitmentToolTip.css';

const images = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    images[key] = imageContext(item);
});

const RecruitmentTooltip = ({ playerCities, onCancelTrain, isLocked, countdown }) => {
    // #comment Safely converts Firestore Timestamps or JS Dates into a JS Date object
    const getSafeDate = (timestamp) => {
        if (!timestamp) return null;
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate(); // It's a Firestore Timestamp
        }
        return new Date(timestamp); // It's a JS Date or milliseconds
    };
    
    // #comment Combine all relevant queues (barracks, shipyard, divine, heal) from all cities
    const allQueues = Object.values(playerCities).flatMap(city => {
        const barracks = (city.barracksQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: false, queueType: 'barracks', index }));
        const shipyard = (city.shipyardQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: false, queueType: 'shipyard', index }));
        const divine = (city.divineTempleQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: false, queueType: 'divineTemple', index }));
        const healing = (city.healQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: true, queueType: 'heal', index }));
        return [...barracks, ...shipyard, ...divine, ...healing];
    })
    .filter(item => {
        const endDate = getSafeDate(item.endTime);
        return endDate && endDate > new Date(); // Filter out completed items
    })
    .sort((a, b) => {
        const dateA = getSafeDate(a.endTime) || new Date(0);
        const dateB = getSafeDate(b.endTime) || new Date(0);
        return dateA - dateB;
    });

    const content = allQueues.length > 0 ? (
        allQueues.map((item) => {
            const unit = unitConfig[item.unitId];
            return (
                <div key={`${item.cityId}-${item.queueType}-${item.index}`} className="recruitment-tooltip-item">
                    <img src={images[unit.image]} alt={unit.name} className="recruitment-tooltip-item-image" />
                    <div className="recruitment-tooltip-item-details">
                        <p className="font-bold">{item.amount}x {unit.name} <span className="text-xs text-gray-400">({item.cityName})</span></p>
                        <div className="recruitment-tooltip-timer">
                            <Countdown arrivalTime={item.endTime} />
                        </div>
                    </div>
                    <button onClick={() => onCancelTrain(item, item.queueType)} className="recruitment-tooltip-cancel-btn">&times;</button>
                </div>
            );
        })
    ) : (
        <p className="p-4 text-center text-sm">No active recruitments.</p>
    );

    return (
        <div className="recruitment-tooltip">
            {content}
            <div className="recruitment-tooltip-lock-timer">
                {isLocked ? '🔒' : countdown}
            </div>
        </div>
    );
};

export default RecruitmentTooltip;
