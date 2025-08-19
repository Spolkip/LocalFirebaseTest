import React, { useState } from 'react';
import Modal from '../shared/Modal'; // Assuming you have a Modal component
import buildingConfig from '../../gameData/buildings.json';
import { useAlliance } from '../../contexts/AllianceContext';

const CaveMenu = ({ cityGameState, onClose, saveGameState, currentUser, worldId }) => {
    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [message, setMessage] = useState('');
    const { playerAlliance } = useAlliance();

    console.log("CaveMenu rendered. cityGameState:", cityGameState); // Debugging

    if (!cityGameState) {
        console.log("CaveMenu: cityGameState is null, showing loading modal."); // Debugging
        return <Modal message="Loading city data..." onClose={onClose} />;
    }

    const caveLevel = cityGameState.buildings.cave?.level || 0;
    const maxCaveLevel = buildingConfig.cave.maxLevel;
    
    let maxSilverStorage = caveLevel === maxCaveLevel ? Infinity : caveLevel * 1000;
    if (playerAlliance?.research) {
        const caveBoostLevel = playerAlliance.research.subterranean_expansion?.level || 0;
        if (maxSilverStorage !== Infinity) {
            maxSilverStorage *= (1 + caveBoostLevel * 0.05);
        }
    }
    maxSilverStorage = Math.floor(maxSilverStorage);

    const currentSilverInCave = cityGameState.cave?.silver || 0;

    const handleDeposit = async () => {
        const amount = parseInt(depositAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            setMessage('Please enter a valid amount to deposit.');
            return;
        }

        if (cityGameState.resources.silver < amount) {
            setMessage('Not enough silver in your city to deposit.');
            return;
        }

        if (currentSilverInCave + amount > maxSilverStorage) {
            setMessage(`Cannot deposit. Cave storage limit is ${maxSilverStorage.toLocaleString()}.`);
            return;
        }

        try {
            const newGameState = { ...cityGameState };
            newGameState.resources.silver -= amount;
            newGameState.cave.silver = currentSilverInCave + amount;
            
            await saveGameState(newGameState);
            setMessage(`Successfully deposited ${amount} silver.`);
            setDepositAmount('');
        } catch (error) {
            console.error("Error depositing silver: ", error);
            setMessage('Failed to deposit silver. Please try again.');
        }
    };

    const handleWithdraw = async () => {
        const amount = parseInt(withdrawAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            setMessage('Please enter a valid amount to withdraw.');
            return;
        }

        if (currentSilverInCave < amount) {
            setMessage('Not enough silver in the cave to withdraw.');
            return;
        }

        try {
            const newGameState = { ...cityGameState };
            newGameState.resources.silver += amount;
            newGameState.cave.silver = currentSilverInCave - amount;

            await saveGameState(newGameState);
            setMessage(`Successfully withdrew ${amount} silver.`);
            setWithdrawAmount('');
        } catch (error) {
            console.error("Error withdrawing silver: ", error);
            setMessage('Failed to withdraw silver. Please try again.');
        }
    };

    return (
        <Modal onClose={onClose} title="Cave">
            <div className="p-4 bg-gray-800 text-white rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">Cave</h2>
                <p className="text-center mb-4">
                    Silver in Cave: <span className="font-semibold text-green-400">{currentSilverInCave.toLocaleString()}</span> / <span className="font-semibold text-blue-400">{maxSilverStorage === Infinity ? '∞' : maxSilverStorage.toLocaleString()}</span>
                </p>

                <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2 text-yellow-300">Deposit Silver</h3>
                    <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Amount to deposit"
                        className="w-full p-2 mb-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                    />
                    <button
                        onClick={handleDeposit}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out shadow-md"
                    >
                        Deposit
                    </button>
                </div>

                <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2 text-yellow-300">Withdraw Silver</h3>
                    <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Amount to withdraw"
                        className="w-full p-2 mb-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400"
                    />
                    <button
                        onClick={handleWithdraw}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out shadow-md"
                    >
                        Withdraw
                    </button>
                </div>

                {message && (
                    <p className="mt-4 p-2 bg-blue-700 text-white rounded text-center">
                        {message}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default CaveMenu;
