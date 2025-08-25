// src/components/city/AdminCheatMenu.js
import React, { useState,  } from 'react';
import unitConfig from '../../gameData/units.json';
import researchConfig from '../../gameData/research.json'; // Import research config
import { useGame } from '../../contexts/GameContext';

const AdminCheatMenu = ({ onCheat, onClose, InstantBuildActive}) => {
    const [amounts, setAmounts] = useState({ wood: 0, stone: 0, silver: 0});
    const [troop, setTroop] = useState({ unit: 'swordsman', amount: 0 });
    const [warehouseLevels, setWarehouseLevels] = useState(0);
    const {isInstantBuild, setIsInstantBuild, isInstantResearch, setIsInstantResearch, isInstantUnits, setIsInstantUnits } = useGame();
    const [unresearchId, setUnresearchId] = useState(''); // New state for unresearch
    const [favorAmount, setFavorAmount] = useState(0); // #comment Re-added favor cheat state
    const [farmLevels, SetFarmLevel] = useState(0);
    const [healHero, setHealHero] = useState(false); // New state for healing hero
    
    

    const handleCheat = () => {
        onCheat(amounts, troop, farmLevels, warehouseLevels, isInstantBuild, unresearchId, isInstantResearch, isInstantUnits, favorAmount, false, false, healHero); // Pass healHero
        onClose();
    };

    // #comment Handler for the new "Found Second City" button
    const handleFoundCity = () => {
        onCheat({}, {}, 0, false, '', false, false, 0, true, false, false); 
        onClose();
    };

    // #comment Handler for the "Force Refresh Data" button
    const handleForceRefresh = () => {
        onCheat({}, {}, 0, false, '', false, false, 0, false, true, false); // Pass true for forceRefresh
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Admin Cheats</h3>
                <div className="space-y-4">
                    {Object.keys(amounts).map(resource => (
                        <div key={resource} className="flex justify-between items-center">
                            <label className="text-white capitalize">{resource}</label>
                            <input
                                type="number"
                                value={amounts[resource]}
                                onChange={(e) => setAmounts(prev => ({ ...prev, [resource]: parseInt(e.target.value, 10) || 0 }))}
                                className="bg-gray-700 text-white rounded p-2 w-32"
                            />
                        </div>
                    ))}
                    <div className="flex justify-between items-center">
                        <label className="text-white capitalize">Add Troops</label>
                        <select
                            value={troop.unit}
                            onChange={(e) => setTroop(prev => ({ ...prev, unit: e.target.value }))}
                            className="bg-gray-700 text-white rounded p-2 w-32"
                        >
                            {Object.keys(unitConfig).map(unitId => (
                                <option key={unitId} value={unitId}>{unitConfig[unitId].name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={troop.amount}
                            onChange={(e) => setTroop(prev => ({ ...prev, amount: parseInt(e.target.value, 10) || 0 }))}
                            className="bg-gray-700 text-white rounded p-2 w-24"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-white capitalize">Set Warehouse Level</label>
                        <input
                            type="number"
                            min="1"
                            value={warehouseLevels}
                            onChange={(e) => setWarehouseLevels(parseInt(e.target.value, 10) || 0)}
                            className="bg-gray-700 text-white rounded p-2 w-32" 
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-white capitalize">Set Farm Level</label>
                        <input
                            type="number"
                            min="1"
                            value={farmLevels}
                            onChange={(e) => SetFarmLevel(parseInt(e.target.value, 10) || 0)}
                            className="bg-gray-700 text-white rounded p-2 w-32" 
                        />
                    </div>
                    {/* New Cheat: Unresearch Option */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                        <label htmlFor="unresearch" className="text-white">Unresearch:</label>
                        <select
                            id="unresearch"
                            value={unresearchId}
                            onChange={(e) => setUnresearchId(e.target.value)}
                            className="bg-gray-700 text-white rounded p-2 w-40"
                        >
                            <option value="">Select Research</option>
                            {Object.keys(researchConfig).map(researchKey => (
                                <option key={researchKey} value={researchKey}>
                                    {researchConfig[researchKey].name}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* #comment Re-added favor cheat option */}
                    <div className="flex justify-between items-center">
                        <label htmlFor="addFavor" className="text-white">Add Favor:</label>
                        <input
                            id="addFavor"
                            type="number"
                            value={favorAmount}
                            onChange={(e) => setFavorAmount(parseInt(e.target.value, 10) || 0)}
                            className="bg-gray-700 text-white rounded p-2 w-32"
                        />
                    </div>
                    {/* New Checkbox for Instant Build */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                        <label htmlFor="isInstantBuild" className="text-white capitalize">1-Second Builds</label>
                        <input
                            id="isInstantBuild"
                            type="checkbox"
                            checked={isInstantBuild}
                            onChange={(e) => setIsInstantBuild(e.target.checked)}
                            className="w-6 h-6 rounded"
                        />
                    </div>
                    {/* New Checkbox for Instant Research */}
                    <div className="flex justify-between items-center">
                        <label htmlFor="isInstantResearch" className="text-white capitalize">1-Second Research</label>
                        <input
                            id="isInstantResearch"
                            type="checkbox"
                            checked={isInstantResearch}
                            onChange={(e) => setIsInstantResearch(e.target.checked)}
                            className="w-6 h-6 rounded"
                        />
                    </div>
                    {/* New Checkbox for Instant Units */}
                    <div className="flex justify-between items-center">
                        <label htmlFor="isInstantUnits" className="text-white capitalize">1-Second Units</label>
                        <input
                            id="isInstantUnits"
                            type="checkbox"
                            checked={isInstantUnits}
                            onChange={(e) => setIsInstantUnits(e.target.checked)}
                            className="w-6 h-6 rounded"
                        />
                    </div>
                    {/* New Checkbox for Healing Hero */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                        <label htmlFor="healHero" className="text-white capitalize">Instantly Heal Hero</label>
                        <input
                            id="healHero"
                            type="checkbox"
                            checked={healHero}
                            onChange={(e) => setHealHero(e.target.checked)}
                            className="w-6 h-6 rounded"
                        />
                    </div>
                </div>
                <button onClick={handleFoundCity} className="btn btn-primary w-full py-2 mt-4 bg-yellow-600 hover:bg-yellow-500">
                    Found Second City
                </button>
                <button onClick={handleCheat} className="btn btn-primary w-full py-2 mt-2">
                    Apply Cheats
                </button>
                <button onClick={handleForceRefresh} className="btn btn-secondary w-full py-2 mt-2 bg-blue-600 hover:bg-blue-500">
                    Force Refresh Data
                </button>
            </div>
        </div>
    );
};

export default AdminCheatMenu;
