import React from 'react';
import buildingConfig from '../../gameData/buildings.json';

const BuildingDetailsModal = ({ buildingId, buildingData, onClose, getProductionRates, getWarehouseCapacity, getFarmCapacity, onOpenBarracks, onOpenShipyard, onAddWorker, onRemoveWorker, availablePopulation, getMaxWorkerSlots, onOpenMarket }) => {
    const config = buildingConfig[buildingId];
    if (!config) return null;

    const nextLevel = buildingData.level + 1;
    const isProductionBuilding = ['timber_camp', 'quarry', 'silver_mine'].includes(buildingId);
    const workers = buildingData.workers || 0;
    const maxWorkers = isProductionBuilding ? getMaxWorkerSlots(buildingData.level) : 0;

    const handleAddWorker = () => {
        if (availablePopulation >= 20) {
            onAddWorker(buildingId);
        } else {
            console.warn("Not enough available population. Each worker requires 20 population.");
        }
    };

    const getResourceType = (id) => {
        if (id === 'timber_camp') return 'wood';
        if (id === 'quarry') return 'stone';
        if (id === 'silver_mine') return 'silver';
        return '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-title text-3xl text-white">{config.name}</h3>
                        <p className="text-yellow-300 font-bold text-lg">Level {buildingData.level}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <p className="text-gray-400 mt-2 mb-6">{config.description}</p>

                {isProductionBuilding && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Production (per hour):</p>
                        <p>Current: {getProductionRates({ [buildingId]: buildingData })[getResourceType(buildingId)].toLocaleString()}</p>
                        <p>Next Level: {getProductionRates({ [buildingId]: { level: nextLevel, workers: workers } })[getResourceType(buildingId)].toLocaleString()}</p>
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="font-semibold text-lg mb-2">Worker Slots ({workers}/{maxWorkers})</h4>
                            <div className="flex items-center space-x-2">
                                {Array.from({ length: maxWorkers }).map((_, i) => (
                                    <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center ${i < workers ? 'bg-green-500' : 'bg-gray-600'}`}>
                                        {/* You can add an icon here if you want */}
                                    </div>
                                ))}
                                <div className="flex flex-col space-y-1">
                                     <button onClick={handleAddWorker} disabled={workers >= maxWorkers || availablePopulation < 20} className="w-6 h-6 flex items-center justify-center bg-gray-500 hover:bg-gray-400 rounded-md text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">+</button>
                                     <button onClick={() => onRemoveWorker(buildingId)} disabled={workers <= 0} className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-500 rounded-md text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">-</button>
                                </div>
                            </div>
                            {/* #comment Updated text to reflect new happiness mechanic */}
                            <p className="text-xs mt-2 text-gray-400">Each worker costs 20 population, boosts production by 10%, and reduces city happiness by 5.</p>
                        </div>
                    </div>
                )}

                {buildingId === 'warehouse' && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Capacity:</p>
                        <p>Current: {getWarehouseCapacity(buildingData.level).toLocaleString()}</p>
                        <p>Next Level: {getWarehouseCapacity(nextLevel).toLocaleString()}</p>
                    </div>
                )}

                {buildingId === 'farm' && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Population Capacity:</p>
                        <p>Current: {getFarmCapacity(buildingData.level).toLocaleString()}</p>
                        <p>Next Level: {getFarmCapacity(nextLevel).toLocaleString()}</p>
                    </div>
                )}

                {buildingId === 'barracks' && (
                    <button onClick={onOpenBarracks} className="btn btn-primary w-full py-2">
                        Train Troops
                    </button>
                )}

                {buildingId === 'shipyard' && (
                    <button onClick={onOpenShipyard} className="btn btn-primary w-full py-2">
                        Build Naval Units
                    </button>
                )}
                
                {/* #comment Add button to open market from details view */}
                {buildingId === 'market' && (
                    <button onClick={onOpenMarket} className="btn btn-primary w-full py-2">
                        Open Market
                    </button>
                )}
            </div>
        </div>
    );
};

export default BuildingDetailsModal;
