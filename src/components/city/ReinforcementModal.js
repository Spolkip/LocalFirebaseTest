import React from 'react';
import unitConfig from '../../gameData/units.json';
import { useAuth } from '../../contexts/AuthContext';

const images = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    images[key] = imageContext(item);
});

const ReinforcementsModal = ({ city, onClose, onOpenWithdraw }) => {
    const { currentUser } = useAuth();
    const reinforcements = city.reinforcements || {};

    const renderUnit = ([unitId, count]) => {
        const unit = unitConfig[unitId];
        if (!unit || !unit.image) return null;
        const imageUrl = images[unit.image];
        if (!imageUrl) return null;
        return (
            <div key={unitId} className="flex items-center gap-2">
                <img src={imageUrl} alt={unit.name} className="w-8 h-8 object-contain" />
                <span>{unit.name}: {count}</span>
            </div>
        );
    };

    const canWithdraw = Object.values(reinforcements).some(reinf => reinf.ownerId === currentUser.uid);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Reinforcements in {city.cityName}</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {Object.keys(reinforcements).length > 0 ? (
                        Object.entries(reinforcements).map(([originCityId, reinfData]) => (
                            <div key={originCityId} className="bg-gray-700 p-3 rounded-lg">
                                <h4 className="font-bold text-yellow-400 mb-2">From: {reinfData.originCityName}</h4>
                                <div className="space-y-1">
                                    {Object.entries(reinfData.units || {}).map(renderUnit)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-400">No reinforcements in this city.</p>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-600 flex justify-end">
                    {canWithdraw && (
                        <button onClick={() => onOpenWithdraw(city)} className="btn btn-confirm py-2 px-6">
                            Withdraw Troops
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReinforcementsModal;
