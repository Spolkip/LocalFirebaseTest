import React, { useState } from 'react';
import agentsConfig from '../../gameData/agents.json';

const EmptyCityModal = ({ plot, onClose, onFoundCity, cityGameState }) => {
    const [selectedAgent, setSelectedAgent] = useState('architect');
    const [villagers, setVillagers] = useState(1);

    const availableVillagers = cityGameState.units?.villager || 0;
    const availableArchitects = cityGameState.agents?.architect || 0;

    const handleFoundCity = () => {
        if (availableArchitects < 1) {
            alert("You don't have an architect to found a new city.");
            return;
        }
        if (villagers > availableVillagers) {
            alert("You don't have that many villagers available.");
            return;
        }
        onFoundCity(plot, selectedAgent, villagers);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Found New City</h3>
                <p>Select an agent and villagers to send to found a new city on this empty plot.</p>
                
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
                    <label htmlFor="villagers" className="block text-sm font-medium text-gray-300">Number of Villagers (Available: {availableVillagers}):</label>
                    <input
                        type="number"
                        id="villagers"
                        name="villagers"
                        min="1"
                        max={availableVillagers}
                        value={villagers}
                        onChange={(e) => setVillagers(parseInt(e.target.value, 10))}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">More villagers will reduce the founding time.</p>
                </div>
                <div className="flex justify-end space-x-4">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={handleFoundCity} className="btn btn-primary" disabled={availableArchitects < 1 || villagers > availableVillagers || villagers < 1}>Found City</button>
                </div>
            </div>
        </div>
    );
};

export default EmptyCityModal;
