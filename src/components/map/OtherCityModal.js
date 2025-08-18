// src/components/map/OtherCityModal.js
import React, { useMemo } from 'react';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';
import ruinsResearch from '../../gameData/ruinsResearch.json';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import './OtherCityModal.css';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';

const OtherCityModal = ({ city, onClose, onGoTo, onAction, isVillageTarget }) => {
    const { currentUser } = useAuth();
    const { setActiveCityId } = useGame();

    const canWithdraw = useMemo(() => {
        if (!city || !city.reinforcements) return false;
        return Object.values(city.reinforcements).some(reinf => reinf.ownerId === currentUser.uid);
    }, [city, currentUser.uid]);

    if (!city) return null;

    const isOwnCity = city.ownerId === currentUser.uid;

    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };

    const handleGoTo = () => {
        if (onGoTo) {
            onGoTo(city.x, city.y);
        }
        onClose();
    };
    
    const handleGoToCity = () => {
        setActiveCityId(city.id);
        onClose();
    };

    const isRuin = city.isRuinTarget;
    const isConqueredRuin = isRuin && city.ownerId && city.ownerId !== 'ruins';
    const researchReward = isRuin ? ruinsResearch[city.researchReward] : null;

    const title = isRuin 
        ? `Ancient Ruins` 
        : isVillageTarget 
        ? `Farming Village: ${city.name || 'Unnamed Village'} (Level ${city.level || '?'})` 
        : `City: ${city.cityName || 'Unnamed City'}`;
    
    const ownerText = `Owner: ${city.ownerUsername || 'Unknown'}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <h3 className="font-title text-2xl">{title}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    {!isConqueredRuin && <p className="mb-2">{ownerText}</p>}
                    {city.ownerFaction && <p className="mb-6">Faction: {city.ownerFaction}</p>}
                    
                    {(isVillageTarget || isRuin) && (
                        <div className="info-box">
                            {isVillageTarget && (
                                <div className="flex justify-center items-center space-x-4">
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm capitalize">Demands</span>
                                        <img src={resourceImages[city.demands]} alt={city.demands} className="w-10 h-10" />
                                    </div>
                                    <span className="text-3xl font-bold">&rarr;</span>
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm capitalize">Supplies</span>
                                        <img src={resourceImages[city.supplies]} alt={city.supplies} className="w-10 h-10" />
                                    </div>
                                </div>
                            )}
                            {isRuin && !isConqueredRuin && researchReward && (
                                 <div className="text-center">
                                    <p className="font-bold text-yellow-700">Potential Reward:</p>
                                    <p className="text-sm">{researchReward.name}</p>
                                    <p className="text-xs italic">"{researchReward.description}"</p>
                                </div>
                            )}

                            {isConqueredRuin && (
                                 <div className="text-center">
                                    <p className="font-bold text-green-700">Conquered by:</p>
                                    <p className="text-lg">{city.ownerUsername}</p>
                                    {city.isConqueredByYou && researchReward && (
                                        <div className="mt-2 border-t border-gray-600 pt-2">
                                            <p className="font-bold text-yellow-700">Research Unlocked:</p>
                                            <p className="text-sm">{researchReward.name}</p>
                                            <p className="text-xs italic">"{researchReward.description}"</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {city.troops && Object.keys(city.troops).length > 0 && !isConqueredRuin && (
                                <div className="mt-4 border-t border-gray-600 pt-2">
                                    <TroopDisplay units={city.troops} unitsData={unitsData} title={isRuin ? "Guardians" : "Village Troops"} />
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!isRuin &&
                        <div className="info-box">
                            <TroopDisplay
                                units={city.units}
                                reinforcements={city.reinforcements}
                                title="Garrison"
                                cityOwnerId={city.ownerId}
                            />
                        </div>
                    }

                    <div className="action-buttons-grid">
                        {(isVillageTarget || (isRuin && !isConqueredRuin)) ? (
                            <button 
                                onClick={() => onAction('attack', city)}
                                className="action-btn attack-btn col-span-2"
                            >
                                Attack
                            </button>
                        ) : !isRuin ? (
                            <>
                                {isOwnCity ? (
                                    <button 
                                        onClick={handleGoToCity}
                                        className="action-btn col-span-2"
                                    >
                                        Go to City
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => onAction('attack', city)}
                                            className="action-btn attack-btn"
                                        >
                                            Attack
                                        </button>
                                        <button 
                                            onClick={() => onAction('reinforce', city)}
                                            className="action-btn reinforce-btn"
                                        >
                                            Reinforce
                                        </button>
                                        {canWithdraw && (
                                            <button 
                                                onClick={() => onAction('withdraw', city)}
                                                className="action-btn"
                                            >
                                                Withdraw Troops
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onAction('scout', city)}
                                            className="action-btn"
                                        >
                                            Scout
                                        </button>
                                        <button 
                                            onClick={() => onAction('trade', city)}
                                            className="action-btn"
                                        >
                                            Trade
                                        </button>
                                         <button 
                                            onClick={() => onAction('castSpell', city)}
                                            className="action-btn spell-btn"
                                        >
                                            Cast Spell
                                        </button>
                                        <button 
                                            onClick={() => onAction('profile', city)}
                                            className="action-btn"
                                        >
                                            Profile
                                        </button>
                                        <button 
                                            onClick={handleGoTo}
                                            className="action-btn"
                                        >
                                            Go To
                                        </button>
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OtherCityModal;
