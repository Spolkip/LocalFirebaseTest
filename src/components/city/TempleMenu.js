import React, { useState } from 'react';
import godsConfig from '../../gameData/gods.json';

// Dynamically import all images from the images/gods folder
const images = require.context('../../images/gods', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});

const TempleMenu = ({ city, onWorship, onClose, favorData }) => {
    const playerReligion = city.playerInfo.religion;
    const currentGod = city.god;
    
    const availableGods = (playerReligion && godsConfig[playerReligion.toLowerCase()]) || {};
    const firstGodName = Object.keys(availableGods)[0] || null;
    const [selectedGodName, setSelectedGodName] = useState(currentGod || firstGodName);

    const selectedGodDetails = selectedGodName ? availableGods[selectedGodName] : null;

    // --- NEW FAVOR DISPLAY LOGIC ---
    const favor = selectedGodName ? (favorData[selectedGodName] || 0) : 0;
    const templeLevel = city.buildings.temple?.level || 0;
    const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
    const favorPercentage = maxFavor > 0 ? (favor / maxFavor) * 100 : 0;
    // --- END ---

    const buttonDisabled = !selectedGodName || selectedGodName === currentGod;
    let buttonText;
    if (currentGod && selectedGodName === currentGod) {
        buttonText = `Currently Worshipping ${currentGod}`;
    } else if (selectedGodName) {
        buttonText = `Worship ${selectedGodName}`;
    } else {
        buttonText = "Select a God";
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border-2 border-yellow-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl">Temple in {city.name}</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <div className="flex gap-6">
                    {/* Left Sidebar for God Selection */}
                    <div className="flex flex-col gap-2 p-2 bg-gray-900 border border-gray-700 rounded-lg">
                        {Object.values(availableGods).map(god => (
                            <button
                                key={god.name}
                                onClick={() => setSelectedGodName(god.name)}
                                className={`w-20 h-20 flex items-center justify-center rounded-lg overflow-hidden transition-all border-2 ${selectedGodName === god.name ? 'bg-gray-700 border-yellow-400' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                                title={god.name}
                            >
                                <img src={imageMap[god.image]} alt={god.name} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>

                    {/* Main Content Area for God Details */}
                    <div className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-4">
                        {selectedGodDetails ? (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-32 h-32 p-1 bg-gray-800 rounded-full border-4 border-stone-500 flex-shrink-0 overflow-hidden">
                                        <img src={imageMap[selectedGodDetails.image]} alt={selectedGodDetails.name} className="w-full h-full object-cover rounded-full" />
                                    </div>
                                    <div>
                                        <h4 className="font-title text-4xl text-yellow-400">{selectedGodDetails.name}</h4>
                                        <p className="text-gray-400">{selectedGodDetails.description}</p>
                                    </div>
                                </div>

                                {/* Favor Bar */}
                                <div className="mt-4">
                                    <h5 className="text-lg font-bold mb-2">Favor for {selectedGodName}</h5>
                                    <div className="bg-gray-700 rounded-full h-6 border border-gray-600">
                                        <div
                                            className="bg-blue-500 h-full rounded-full text-center text-white text-sm flex items-center justify-center transition-all duration-500"
                                            style={{ width: `${favorPercentage}%` }}
                                        >
                                            <span>{Math.floor(favor)} / {maxFavor}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 text-center mt-1">Favor increases over time based on this city's Temple level.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div>
                                        <h5 className="text-lg font-bold mb-2 text-yellow-500">Divine Powers</h5>
                                        <ul className="list-disc list-inside text-gray-300">
                                            {selectedGodDetails.powers.map(power => <li key={power.name}>{power.name}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h5 className="text-lg font-bold mb-2 text-yellow-500">Mythical Units</h5>
                                        <ul className="list-disc list-inside text-gray-300">
                                            {selectedGodDetails.mythical_units.map(unit => <li key={unit}>{unit}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-center p-10">Select a god to view their details.</p>
                        )}
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={() => onWorship(selectedGodName)}
                        disabled={buttonDisabled}
                        className={`w-full py-3 btn text-lg ${buttonDisabled ? 'btn-disabled' : 'btn-confirm'}`}
                    >
                        {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TempleMenu;