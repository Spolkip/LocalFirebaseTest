// src/components/city/WorshipDisplay.js
import React from 'react';
import godsConfig from '../../gameData/gods.json';
import spellsIcon from '../../images/spells.png';

// Dynamically import all images from the images/gods folder
const images = require.context('../../images/gods', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});


const WorshipDisplay = ({ godName, playerReligion, worship, buildings, onOpenPowers }) => {

    const getGodDetails = (name, religion) => {
        if (!name || !religion) return null;
        const religionKey = religion.toLowerCase();
        const pantheon = godsConfig[religionKey];
        if (!pantheon) return null;
        return Object.values(pantheon).find(g => g.name === name);
    };

    const godDetails = getGodDetails(godName, playerReligion);

    const favor = godName && worship ? (worship[godName] || 0) : 0;
    const templeLevel = buildings?.temple?.level || 0;
    const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;

    return (
        <div className="worship-display-container">
            {godName && godDetails ? (
                <div className="text-center">
                    <img src={imageMap[godDetails.image]} alt={godDetails.name} className="w-24 h-24 mx-auto rounded-full border-4 border-yellow-500" />
                    <p className="text-lg font-bold mt-2">{godName}</p>
                    <p className="text-sm text-blue-600 mt-2">Favor: {Math.floor(favor)} / {maxFavor}</p>
                    <button onClick={onOpenPowers} className="spells-button">
                        <img src={spellsIcon} alt="View Spells" className="w-10 h-10 object-contain"/>
                    </button>
                </div>
            ) : (
                <p className="text-gray-500 text-center text-sm">Build a Temple to worship a god.</p>
            )}
        </div>
    );
};

export default WorshipDisplay;
