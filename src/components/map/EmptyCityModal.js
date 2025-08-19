import React, { useState, useMemo, useEffect } from 'react';
import agentsConfig from '../../gameData/agents.json';
import unitConfig from '../../gameData/units.json';
import { useGame } from '../../contexts/GameContext';
import { calculateDistance, calculateTravelTime } from '../../utils/travel';

const images = {};
const imageContexts = [
    require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/),
];
imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        images[key] = context(item);
    });
});

const EmptyCityModal = ({ plot, onClose, onFoundCity, cityGameState, playerCity }) => {
    const { worldState } = useGame();
    const [selectedAgent, setSelectedAgent] = useState('architect');
    const [selectedUnits, setSelectedUnits] = useState({ villager: 1 });

    const availableArchitects = cityGameState.agents?.architect || 0;

    const landUnits = useMemo(() => {
        return Object.keys(cityGameState.units || {})
            .filter(unitId => unitConfig[unitId]?.type === 'land' && cityGameState.units[unitId] > 0);
    }, [cityGameState.units]);

    const handleUnitChange = (unitId, value) => {
        const max = cityGameState.units[unitId] || 0;
        const amount = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
        setSelectedUnits(prev => ({ ...prev, [unitId]: amount }));
    };

    const handleFoundCity = () => {
        if (availableArchitects < 1) {
            return;
        }
        if (!selectedUnits.villager || selectedUnits.villager < 1) {
            return;
        }
        onFoundCity(plot, selectedAgent, selectedUnits);
        onClose();
    };

    const totalSelectedUnits = Object.values(selectedUnits).reduce((sum, count) => sum + count, 0);
    const hasVillager = (selectedUnits.villager || 0) > 0;

    const timeInfo = useMemo(() => {
        const slowestSpeed = Object.entries(selectedUnits)
            .filter(([, count]) => count > 0)
            .map(([unitId]) => unitConfig[unitId].speed)
            .reduce((min, speed) => Math.min(min, speed), Infinity);
        
        // #comment Use cityGameState for distance calculation to ensure correct coordinates.
        const distance = calculateDistance(cityGameState, plot);
        const travelTimeSeconds = slowestSpeed === Infinity ? 0 : calculateTravelTime(distance, slowestSpeed, 'found_city', worldState, ['land']);
        
        const baseFoundingTime = 86400;
        const reductionPerVillager = 3600;
        const villagers = selectedUnits.villager || 0;
        const foundingTimeSeconds = Math.max(3600, baseFoundingTime - (villagers * reductionPerVillager));
        return { travelTimeSeconds, foundingTimeSeconds, totalTimeSeconds: travelTimeSeconds + foundingTimeSeconds };
    }, [selectedUnits, cityGameState, plot, worldState]);

    const formatDuration = (seconds) => {
        const totalSeconds = Math.round(seconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Found New City</h3>
                <p>Select an agent and troops to send to found a new city on this empty plot.</p>
                <div className="my-4">
                    <label htmlFor="agent" className="block text-sm font-medium text-gray-300">Agent:</label>
                    <select
                        id="agent"
                        name="agent"
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={availableArchitects < 1}
                    >
                        {Object.keys(agentsConfig).map(agentId => (
                            <option key={agentId} value={agentId}>{agentsConfig[agentId].name} (Available: {cityGameState.agents?.[agentId] || 0})</option>
                        ))}
                    </select>
                </div>
                <div className="my-4">
                    <h4 className="text-lg font-medium text-gray-300 mb-2">Select Troops</h4>
                    <div className="max-h-60 overflow-y-auto p-2 bg-gray-900 rounded-md">
                        {landUnits.length > 0 ? (
                            landUnits.map(unitId => {
                                const unit = unitConfig[unitId];
                                const availableCount = cityGameState.units[unitId];
                                return (
                                    <div key={unitId} className="flex items-center justify-between p-2">
                                        <div className="flex items-center">
                                            <img src={images[unit.image]} alt={unit.name} className="w-10 h-10 mr-3" />
                                            <div>
                                                <p>{unit.name}</p>
                                                <p className="text-xs text-gray-400">Available: {availableCount}</p>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            max={availableCount}
                                            value={selectedUnits[unitId] || ''}
                                            onChange={(e) => handleUnitChange(unitId, e.target.value)}
                                            className="w-20 bg-gray-700 border border-gray-600 rounded-md p-1 text-white text-center"
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-500 text-center">No land units available in this city.</p>
                        )}
                    </div>
                     <p className="text-xs text-gray-400 mt-1">More villagers will reduce the founding time. You must send at least one villager.</p>
                </div>
                <div className="text-center my-4 p-2 bg-gray-700 rounded">
                    <p>Travel Time: <span className="font-bold text-yellow-400">{formatDuration(timeInfo.travelTimeSeconds)}</span></p>
                    <p>Founding Time: <span className="font-bold text-yellow-400">{formatDuration(timeInfo.foundingTimeSeconds)}</span></p>
                    <p className="border-t border-gray-600 mt-1 pt-1">Total Time: <span className="font-bold text-yellow-400">{formatDuration(timeInfo.totalTimeSeconds)}</span></p>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button
                        onClick={handleFoundCity}
                        className="btn btn-primary"
                        disabled={availableArchitects < 1 || totalSelectedUnits === 0 || !hasVillager}
                    >
                        Found City
                    </button>
                </div>
            </div>
        </div>
    );
};
export default EmptyCityModal;