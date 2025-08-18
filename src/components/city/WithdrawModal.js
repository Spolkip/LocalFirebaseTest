// src/components/city/WithdrawModal.js
import React, { useState } from 'react';
import unitConfig from '../../gameData/units.json';
import { useAuth } from '../../contexts/AuthContext';

const images = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    images[key] = imageContext(item);
});

const WithdrawModal = ({ city, onClose, onWithdrawTroops }) => {
    const { currentUser } = useAuth();
    const [withdrawAmounts, setWithdrawAmounts] = useState({});

    // #comment handle changes in the withdrawal amount input fields
    const handleAmountChange = (originCityId, unitId, value) => {
        const max = city.reinforcements?.[originCityId]?.units?.[unitId] || 0;
        const amount = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
        setWithdrawAmounts(prev => ({
            ...prev,
            [originCityId]: {
                ...prev[originCityId],
                [unitId]: amount
            }
        }));
    };

    // #comment initiate the withdrawal process for the selected troops
    const handleWithdraw = () => {
        const hasSelection = Object.values(withdrawAmounts).some(units => 
            Object.values(units).some(amount => amount > 0)
        );
        if (hasSelection) {
            onWithdrawTroops(city, withdrawAmounts);
            onClose();
        }
    };
    
    // #comment handle withdrawing all troops
    const handleWithdrawAll = () => {
        const allReinforcements = city.reinforcements || {};
        const allWithdrawalData = {};

        for (const originCityId in allReinforcements) {
            if (allReinforcements[originCityId].ownerId === currentUser.uid) {
                allWithdrawalData[originCityId] = { ...allReinforcements[originCityId].units };
            }
        }

        if (Object.keys(allWithdrawalData).length > 0) {
            onWithdrawTroops(city, allWithdrawalData);
            onClose();
        }
    };

    // #comment Filter reinforcements to only show those owned by the current user
    const myReinforcements = Object.entries(city.reinforcements || {})
        .filter(([, reinfData]) => reinfData.ownerId === currentUser.uid);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Withdraw Your Troops from {city.cityName}</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {myReinforcements.length > 0 ? myReinforcements.map(([originCityId, reinfData]) => (
                        <div key={originCityId} className="bg-gray-700 p-3 rounded-lg">
                            <h4 className="font-bold text-yellow-400 mb-2">From: {reinfData.originCityName}</h4>
                            <div className="space-y-2">
                                {Object.entries(reinfData.units || {}).map(([unitId, count]) => {
                                    const unit = unitConfig[unitId];
                                    return (
                                        <div key={unitId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img src={images[unit.image]} alt={unit.name} className="w-10 h-10 object-contain" />
                                                <div>
                                                    <p className="font-bold text-white">{unit.name}</p>
                                                    <p className="text-sm text-gray-400">Count: {count}</p>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                value={withdrawAmounts[originCityId]?.[unitId] || ''}
                                                onChange={(e) => handleAmountChange(originCityId, unitId, e.target.value)}
                                                className="bg-gray-800 text-white rounded p-2 w-24 text-center"
                                                placeholder="Amount"
                                                max={count}
                                                min="0"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-gray-400">You have no troops to withdraw from this city.</p>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-600 flex justify-end gap-4">
                    <button onClick={handleWithdrawAll} className="btn btn-primary py-2 px-6">
                        Withdraw All
                    </button>
                    <button onClick={handleWithdraw} className="btn btn-confirm py-2 px-6">
                        Withdraw Selected Troops
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WithdrawModal;