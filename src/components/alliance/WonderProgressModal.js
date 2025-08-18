// src/components/alliance/WonderProgressModal.js
import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';
import allianceWonders from '../../gameData/alliance_wonders.json';
import { getWonderProgress } from '../../hooks/actions/useAllianceWonderActions';

const WonderProgressModal = ({ onClose }) => {
    const { playerAlliance, donateToWonder, claimWonderLevel } = useAlliance();
    const { currentUser } = useAuth();
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [message, setMessage] = useState('');

    const isLeader = playerAlliance?.leader?.uid === currentUser?.uid;
    const currentWonder = playerAlliance?.allianceWonder;
    const wonderConfig = currentWonder ? allianceWonders[currentWonder.id] : null;

    if (!currentWonder || !wonderConfig) {
        return null; // Or a loading/error state
    }

    const handleDonationChange = (e) => {
        const { name, value } = e.target;
        setDonation(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const handleDonate = async () => {
        setMessage('');
        try {
            await donateToWonder(currentWonder.id, donation);
            setMessage('Donation successful!');
            setDonation({ wood: 0, stone: 0, silver: 0 });
        } catch (error) {
            setMessage(`Donation failed: ${error.message}`);
        }
    };
    
    const handleClaimLevel = async () => {
        setMessage('');
        if (!isLeader) return;
        try {
            await claimWonderLevel(currentWonder.id);
            setMessage(`Wonder upgraded to level ${currentWonder.level + 1}!`);
        } catch (error) {
            setMessage(`Claim failed: ${error.message}`);
        }
    };

    const getWonderCost = (level) => {
        if (!wonderConfig) return { wood: 0, stone: 0, silver: 0 };
        const costMultiplier = Math.pow(1.5, level);
        return {
            wood: Math.floor(100000 * costMultiplier),
            stone: Math.floor(100000 * costMultiplier),
            silver: Math.floor(50000 * costMultiplier)
        };
    };

    const nextLevel = currentWonder.level + 1;
    const nextLevelCost = getWonderCost(currentWonder.level);
    const progress = getWonderProgress(playerAlliance, currentWonder.id);
    
    const totalProgress = (progress.wood || 0) + (progress.stone || 0) + (progress.silver || 0);
    const totalCost = (nextLevelCost.wood || 0) + (nextLevelCost.stone || 0) + (nextLevelCost.silver || 0);
    const progressPercent = totalCost > 0 ? (totalProgress / totalCost) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{wonderConfig.name} (Level {currentWonder.level})</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {message && <p className="text-center text-yellow-400 mb-4">{message}</p>}
                
                <p className="text-sm italic mb-4">{wonderConfig.description}</p>
                <div className="w-full bg-gray-700 rounded-full h-8 mb-4 relative">
                    <div
                        className="bg-yellow-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
                        {Math.min(100, progressPercent).toFixed(1)}% to Level {nextLevel}
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-center mb-4">
                    <div>Wood: {progress.wood.toLocaleString()} / {nextLevelCost.wood.toLocaleString()}</div>
                    <div>Stone: {progress.stone.toLocaleString()} / {nextLevelCost.stone.toLocaleString()}</div>
                    <div>Silver: {progress.silver.toLocaleString()} / {nextLevelCost.silver.toLocaleString()}</div>
                </div>

                {isLeader && (
                    <button
                        onClick={handleClaimLevel}
                        disabled={progressPercent < 100}
                        className="btn btn-confirm w-full mb-4"
                    >
                        {progressPercent >= 100 ? `Claim Level ${nextLevel}` : `Requires more resources`}
                    </button>
                )}

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h5 className="font-bold text-lg mb-2">Donate Resources</h5>
                    <div className="flex gap-2">
                        <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Wood" />
                        <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Stone" />
                        <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Silver" />
                    </div>
                    <button onClick={handleDonate} className="btn btn-primary w-full mt-4">Donate</button>
                </div>
            </div>
        </div>
    );
};

export default WonderProgressModal;