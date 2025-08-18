import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import godsConfig from '../gameData/gods.json';
import Modal from './shared/Modal';

const Temple = ({ onClose }) => {
    const { gameState, setGameState, playerNationality } = useGame();
    const [selectedGod, setSelectedGod] = useState(gameState.god || null);
    const [message, setMessage] = useState('');

    const handleSelectGod = (god) => {
        setSelectedGod(god);
    };

    const handleWorship = () => {
        if (!selectedGod) {
            setMessage("You must select a god to worship.");
            return;
        }
        const newGameState = { ...gameState, god: selectedGod };
        setGameState(newGameState);
        setMessage(`You are now worshipping ${selectedGod}.`);
        onClose();
    };

    const availableGods = godsConfig[playerNationality.toLowerCase()] || {};

    return (
        <Modal onClose={onClose} title="Temple">
            <div className="p-4 bg-gray-800 text-white rounded-lg max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">Choose a Deity to Worship</h2>
                {message && <p className="text-center text-green-400 mb-4">{message}</p>}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.keys(availableGods).map(godId => {
                        const god = availableGods[godId];
                        const isSelected = selectedGod === god.name;
                        return (
                            <div 
                                key={god.name}
                                className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${isSelected ? 'border-yellow-400 bg-gray-700' : 'border-gray-600 bg-gray-900 hover:bg-gray-700'}`}
                                onClick={() => handleSelectGod(god.name)}
                            >
                                <h3 className="text-xl font-bold text-center text-yellow-500">{god.name}</h3>
                                <p className="text-sm text-gray-400 mt-2 text-center">{god.description}</p>
                                {/* Future additions for powers and units can go here */}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-center">
                    <button 
                        onClick={handleWorship}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Worship {selectedGod || '...'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default Temple;
