// src/components/city/WorkerPresetPanel.js
import React from 'react';
import { useGame } from '../../contexts/GameContext';

const WorkerPresetPanel = ({ cityGameState, onClose, onApplyPresets, getMaxWorkerSlots }) => {
    const { gameSettings } = useGame();
    const presets = gameSettings.workerPresets || {};
    const buildings = ['timber_camp', 'quarry', 'silver_mine'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-2xl">Worker Management</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                    Automatically assign workers based on your presets. You can configure presets in the main settings menu.
                </p>
                <table className="w-full text-left mb-6">
                    <thead>
                        <tr className="border-b border-gray-600">
                            <th className="p-2">Building</th>
                            <th className="p-2 text-center">Current</th>
                            <th className="p-2 text-center">Max</th>
                            <th className="p-2 text-center">Preset</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buildings.map(id => {
                            const building = cityGameState.buildings[id];
                            if (!building || building.level === 0) return null;
                            return (
                                <tr key={id} className="border-b border-gray-700">
                                    <td className="p-2 capitalize font-semibold">{id.replace('_', ' ')}</td>
                                    <td className="p-2 text-center">{building.workers || 0}</td>
                                    <td className="p-2 text-center">{getMaxWorkerSlots(building.level)}</td>
                                    <td className="p-2 text-center">{presets[id] || 0}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <button onClick={onApplyPresets} className="btn btn-confirm w-full py-2">
                    Apply Presets
                </button>
            </div>
        </div>
    );
};

export default WorkerPresetPanel;
