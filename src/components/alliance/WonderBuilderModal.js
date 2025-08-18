// src/components/alliance/WonderBuilderModal.js
import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import allianceWonders from '../../gameData/alliance_wonders.json';

const WonderBuilderModal = ({ onClose, islandId, coords }) => {
    const { startWonder } = useAlliance();
    const [selectedWonder, setSelectedWonder] = useState(null);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleStartWonder = async () => {
        if (!selectedWonder) {
            setMessage('Please select a wonder to build.');
            return;
        }
        setIsSubmitting(true);
        setMessage('Beginning construction...');
        try {
            await startWonder(selectedWonder, islandId, coords);
            setMessage('Construction has begun!');
            onClose();
        } catch (error) {
            setMessage(`Failed to start wonder: ${error.message}`);
            setIsSubmitting(false);
        }
    };

    const startCost = { wood: 50000, stone: 50000, silver: 25000 };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Construct an Alliance Wonder</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {message && <p className="text-center text-yellow-400 mb-4">{message}</p>}
                <p className="text-sm text-gray-400 mb-4">Select a wonder to build on this island. The initial cost will be deducted from your active city's resources.</p>
                <p className="text-center font-bold mb-4">Start Cost: {startCost.wood}W, {startCost.stone}S, {startCost.silver}Ag</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(allianceWonders).map(([id, wonder]) => (
                        <div
                            key={id}
                            onClick={() => setSelectedWonder(id)}
                            className={`p-4 rounded-lg cursor-pointer border-2 ${selectedWonder === id ? 'bg-gray-600 border-yellow-500' : 'bg-gray-700 border-gray-600 hover:border-yellow-400'}`}
                        >
                            <h4 className="font-bold text-lg">{wonder.name}</h4>
                            <p className="text-sm text-gray-400">{wonder.description}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={handleStartWonder}
                    disabled={!selectedWonder || isSubmitting}
                    className="btn btn-confirm w-full mt-6"
                >
                    {isSubmitting ? 'Constructing...' : 'Begin Construction'}
                </button>
            </div>
        </div>
    );
};

export default WonderBuilderModal;
