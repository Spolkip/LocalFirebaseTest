// src/components/city/RecruitmentPanel.js
import React from 'react';
import UnitQueue from './UnitQueue';
import './RecruitmentPanel.css';

const RecruitmentPanel = ({ playerCities, onCancelTrain, onClose }) => {
    const allQueues = Object.values(playerCities).map(city => ({
        cityName: city.cityName,
        unitQueue: city.unitQueue || [],
        healQueue: city.healQueue || [],
        cityId: city.id,
    })).filter(city => city.unitQueue.length > 0 || city.healQueue.length > 0);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="recruitment-panel-bg w-full max-w-2xl rounded-lg" onClick={e => e.stopPropagation()}>
                <div className="recruitment-header rounded-t-sm">
                    <h3>Recruitment & Healing Overview</h3>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                    {allQueues.length > 0 ? (
                        allQueues.map(city => (
                            <div key={city.cityId}>
                                <h4 className="font-bold text-xl mb-2">{city.cityName}</h4>
                                {city.unitQueue.length > 0 && (
                                    <UnitQueue
                                        unitQueue={city.unitQueue}
                                        onCancel={(index) => onCancelTrain(city.cityId, index, false)}
                                        title="Training"
                                    />
                                )}
                                {city.healQueue.length > 0 && (
                                     <UnitQueue
                                        unitQueue={city.healQueue}
                                        onCancel={(index) => onCancelTrain(city.cityId, index, true)}
                                        title="Healing"
                                    />
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="p-8 text-center text-gray-700 italic">No active recruitment or healing queues.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecruitmentPanel;
