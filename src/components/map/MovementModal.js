// src/components/map/MovementModal.js
import React, { useState, useMemo, useEffect } from 'react';
import { calculateTravelTime, formatTravelTime } from '../../utils/travel';
import unitConfig from '../../gameData/units.json';
import heroesConfig from '../../gameData/heroes.json';
import { useGame } from '../../contexts/GameContext';
import './MovementModal.css';

// Import new panels
import TradePanel from './TradePanel';
import ScoutPanel from './ScoutPanel';
import { getTrainableNavalUnits, getTrainableUnits } from '../../utils/nationality';

// Dynamically import all images from the images folder (this is for unit images)
const images = {};
const imageContexts = [
    require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/resources', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/),
];

imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        images[key] = context(item);
    });
});

// #comment Displays the current weather and wind conditions
const WindInfo = ({ weather, windSpeed }) => {
    const [windRange, setWindRange] = useState('');
    const weatherIcons = {
        Clear: '☀️',
        Rainy: '🌧️',
        Windy: '💨',
        Foggy: '🌫️',
        Stormy: '⛈️',
    };

    useEffect(() => {
        let range = '';
        switch (weather) {
            case 'Clear':
                range = '0-3 knots';
                break;
            case 'Windy':
                range = '3-6 knots';
                break;
            case 'Rainy':
                range = '6-9 knots';
                break;
            case 'Stormy':
                range = '9-10 knots';
                break;
            default:
                range = 'N/A';
                break;
        }
        setWindRange(range);
    }, [weather]);

    return (
        <div className="text-gray-500 text-sm mt-2 flex items-center justify-center" title={`${weather} | Wind: ${windSpeed.toFixed(2)} knots (${windRange})`}>
            <span>{weatherIcons[weather]} {weather} | Wind: {windRange}</span>
        </div>
    );
};


// MovementModal component allows players to send units or resources for various actions.
const MovementModal = ({ mode, targetCity, playerCity, playerUnits: initialPlayerUnits, playerResources: initialPlayerResources, travelTimeInfo, onSend, onClose, setMessage }) => {
    const { gameState, worldState } = useGame();
    const [windSpeed, setWindSpeed] = useState(0);

    const currentUnits = initialPlayerUnits || gameState?.units || {};
    const currentResources = initialPlayerResources || gameState?.resources || {};
    const currentHeroes = gameState?.heroes || {};

    const [selectedUnits, setSelectedUnits] = useState({});
    const [selectedHero, setSelectedHero] = useState(null);
    const [selectedResources, setSelectedResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [attackLayers, setAttackLayers] = useState({
        front: '',
        mid: '',
        back: ''
    });

    useEffect(() => {
        if (worldState?.weather) {
            let min = 0, max = 0;
            switch (worldState.weather) {
                case 'Clear': min = 0; max = 3; break;
                case 'Windy': min = 3; max = 6; break;
                case 'Rainy': min = 6; max = 9; break;
                case 'Stormy': min = 9; max = 10; break;
                default: break;
            }
            // #comment Calculate a random wind speed within the weather's range for this specific movement
            setWindSpeed(Math.random() * (max - min) + min);
        }
    }, [worldState?.weather]);


    const transportCapacity = useMemo(() => {
        let capacity = 0;
        for (const unitId in selectedUnits) {
            if (unitConfig[unitId]?.type === 'naval' && unitConfig[unitId]?.capacity) {
                capacity += selectedUnits[unitId] * unitConfig[unitId].capacity;
            }
        }
        return capacity;
    }, [selectedUnits]);

    const currentUnitsLoad = useMemo(() => {
        let load = 0;
        for (const unitId in selectedUnits) {
            if (unitConfig[unitId]?.type === 'land' && unitConfig[unitId]?.cost?.population) {
                load += selectedUnits[unitId] * unitConfig[unitId].cost.population;
            }
        }
        return load;
    }, [selectedUnits]);

    useEffect(() => {
        const newAttackLayers = { ...attackLayers };
        let needsReset = false;
        for (const layer in newAttackLayers) {
            const unitId = newAttackLayers[layer];
            if (unitId && (!selectedUnits[unitId] || selectedUnits[unitId] === 0)) {
                newAttackLayers[layer] = '';
                needsReset = true;
            }
        }
        if (needsReset) {
            setAttackLayers(newAttackLayers);
        }
    }, [selectedUnits, attackLayers]);

    const handleUnitChange = (unitId, value) => {
        const amount = Math.max(0, Math.min(currentUnits[unitId] || 0, parseInt(value, 10) || 0));
        setSelectedUnits(prev => ({ ...prev, [unitId]: amount }));
    };

    // #comment Toggles selecting all units of a type or deselecting them.
    const handleUnitIconClick = (unitId, maxAmount) => {
        const currentAmount = selectedUnits[unitId] || 0;
        const newAmount = currentAmount === maxAmount ? 0 : maxAmount;
        handleUnitChange(unitId, newAmount);
    };

    const handleResourceChange = (resource, value) => {
        const parsedAmount = parseInt(value, 10) || 0;
        let amount = parsedAmount;

        if (mode === 'scout' && resource === 'silver') {
            const availableCaveSilver = gameState.cave?.silver || 0;
            amount = Math.max(0, Math.min(availableCaveSilver, parsedAmount));
        } else {
            amount = Math.max(0, Math.min(currentResources[resource] || 0, parsedAmount));
        }
        setSelectedResources(prev => ({ ...prev, [resource]: amount }));
    };

    const handleLayerChange = (layerName, unitId) => {
        setAttackLayers(prev => {
            const newLayers = { ...prev, [layerName]: unitId };
            return newLayers;
        });
    };

    const slowestSpeed = useMemo(() => {
        if (mode === 'trade' || mode === 'scout') return 10;
        const speeds = Object.entries(selectedUnits)
            .filter(([, count]) => count > 0)
            .map(([unitId]) => unitConfig[unitId].speed);
        return speeds.length > 0 ? Math.min(...speeds) : null;
    }, [selectedUnits, mode]);

    const finalTravelTime = useMemo(() => {
        if (!travelTimeInfo?.distance || !slowestSpeed) return 'N/A';

        const hasLandUnits = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'land' && selectedUnits[unitId] > 0);
        const hasNavalUnits = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'naval' && selectedUnits[unitId] > 0);
        const unitTypes = [];
        if (hasLandUnits) unitTypes.push('land');
        if (hasNavalUnits) unitTypes.push('naval');

        const timeInSeconds = calculateTravelTime(travelTimeInfo.distance, slowestSpeed, mode, worldState, unitTypes, windSpeed);
        return formatTravelTime(timeInSeconds);
    }, [slowestSpeed, travelTimeInfo?.distance, mode, worldState, selectedUnits, windSpeed]);

    const handleSend = () => {
        let totalUnitsSelected = Object.values(selectedUnits).reduce((sum, count) => sum + count, 0);
        let totalResourcesSelected = Object.values(selectedResources).reduce((sum, amount) => sum + amount, 0);

        if ((mode === 'attack' || mode === 'reinforce') && totalUnitsSelected === 0 && !selectedHero) {
            setMessage("Please select at least one unit or a hero to send.");
            return;
        }
        if (mode === 'scout') {
            const silverForScout = selectedResources.silver || 0;
            if (silverForScout <= 0) {
                setMessage("Please enter an amount of silver for scouting.");
                return;
            }
            if (silverForScout > (gameState.cave?.silver || 0)) {
                setMessage("Not enough silver in the cave for scouting.");
                return;
            }
        }
        if (mode === 'trade' && totalResourcesSelected === 0) {
            setMessage("Please select at least one resource to trade.");
            return;
        }

        const hasLandUnitsSelected = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'land' && selectedUnits[unitId] > 0);
        const hasNavalUnitsSelected = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'naval' && selectedUnits[unitId] > 0);

        if (hasLandUnitsSelected && hasNavalUnitsSelected && currentUnitsLoad > transportCapacity) {
            setMessage(`Not enough transport ship capacity. You need ${currentUnitsLoad - transportCapacity} more capacity.`);
            return;
        }

        if (mode === 'attack') {
            const selectedLayerUnits = Object.values(attackLayers).filter(unitId => unitId !== '');
            const uniqueLayerUnits = new Set(selectedLayerUnits);

            if (selectedLayerUnits.length !== uniqueLayerUnits.size) {
                setMessage("Each attack formation layer must have a unique unit selected.");
                return;
            }

            for (const layerName in attackLayers) {
                const unitId = attackLayers[layerName];
                if (unitId !== '' && (selectedUnits[unitId] || 0) === 0) {
                    setMessage(`Your selected ${layerName} unit (${unitConfig[unitId].name}) has 0 troops in the current selection. Please adjust unit counts or selection.`);
                    return;
                }
                if (unitId !== '' && unitConfig[unitId]?.type !== 'land') {
                    setMessage(`The unit selected for ${layerName} (${unitConfig[unitId].name}) must be a land unit.`);
                    return;
                }
            }
        }

        const resourcesToSend = {};
        if (mode === 'scout') {
            resourcesToSend.silver = selectedResources.silver;
        } else if (mode === 'trade') {
            Object.assign(resourcesToSend, selectedResources);
        }

        onSend({
            mode,
            targetCity,
            units: mode === 'scout' || mode === 'trade' ? {} : selectedUnits,
            hero: selectedHero,
            resources: resourcesToSend,
            travelTime: finalTravelTime,
            attackFormation: mode === 'attack' ? attackLayers : {}
        });
        onClose();
    };
    
    const renderContent = () => {
        const playerNation = gameState?.playerInfo?.nation;
    
        const trainableLandUnitIds = playerNation ? getTrainableUnits(playerNation) : [];
        const mythicUnitIds = Object.keys(unitConfig).filter(unitId => {
            const unit = unitConfig[unitId];
            return unit.mythical && unit.god === gameState.god;
        });
        const allTrainableLandIds = [...new Set([...trainableLandUnitIds, ...mythicUnitIds])];
        
        const landUnitsList = allTrainableLandIds.map(unitId => ({
            id: unitId,
            ...unitConfig[unitId],
            currentCount: currentUnits[unitId] || 0
        }));
    
        const trainableNavalUnitIds = playerNation ? getTrainableNavalUnits(playerNation) : [];
        const navalUnitsList = trainableNavalUnitIds.map(unitId => ({
            id: unitId,
            ...unitConfig[unitId],
            currentCount: currentUnits[unitId] || 0
        }));

        const availableHeroes = Object.keys(currentHeroes).filter(heroId => currentHeroes[heroId].active && (currentHeroes[heroId].cityId === gameState.id || !currentHeroes[heroId].cityId));

        const selectedLandUnitsForFormation = Object.keys(selectedUnits).filter(unitId => 
            selectedUnits[unitId] > 0 && unitConfig[unitId]?.type === 'land'
        );

        const attackLayerOptions = [
            { name: 'front', label: 'Front Line' },
            { name: 'mid', label: 'Mid Line' },
            { name: 'back', 'label': 'Back Line' }
        ];

        const capacityProgress = transportCapacity > 0 ? (currentUnitsLoad / transportCapacity) * 100 : 0;
        const progressBarColor = capacityProgress > 100 ? 'bg-red-500' : 'bg-green-500';

        if (mode === 'attack' || mode === 'reinforce') {
            return (
                <div className="space-y-4">
                    {availableHeroes.length > 0 && (
                        <div className="unit-selection-section">
                            <h4 className="unit-selection-header">Heroes</h4>
                            <div className="unit-grid">
                                {availableHeroes.map(heroId => {
                                    const hero = heroesConfig[heroId];
                                    return (
                                        <div key={heroId} className="unit-item">
                                            <div className={`unit-image-container ${selectedHero === heroId ? 'border-2 border-yellow-400' : ''}`} title={hero.name} onClick={() => setSelectedHero(prev => prev === heroId ? null : heroId)}>
                                                <img src={images[hero.image]} alt={hero.name} className="unit-image" />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {landUnitsList.length > 0 && (
                        <div className="unit-selection-section">
                            <h4 className="unit-selection-header">Land Units</h4>
                            <div className="unit-grid">
                                {landUnitsList.map(unit => (
                                    <div key={unit.id} className="unit-item">
                                        <div className="unit-image-container" title={`Select all/none of ${unit.name}`} onClick={() => handleUnitIconClick(unit.id, unit.currentCount)}>
                                            <img src={images[unit.image]} alt={unit.name} className="unit-image" />
                                             <span className="unit-count-badge">
                                                {unit.currentCount}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            value={selectedUnits[unit.id] || 0}
                                            onChange={(e) => handleUnitChange(unit.id, e.target.value)}
                                            className="unit-input hide-number-spinners"
                                            min="0"
                                            max={unit.currentCount}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {navalUnitsList.length > 0 && (
                        <div className="unit-selection-section">
                            <h4 className="unit-selection-header">Naval Units</h4>
                            <div className="unit-grid">
                                {navalUnitsList.map(unit => (
                                    <div key={unit.id} className="unit-item">
                                        <div className="unit-image-container" title={`Select all/none of ${unit.name}`} onClick={() => handleUnitIconClick(unit.id, unit.currentCount)}>
                                            <img src={images[unit.image]} alt={unit.name} className="unit-image" />
                                            <span className="unit-count-badge">
                                                {unit.currentCount}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            value={selectedUnits[unit.id] || 0}
                                            onChange={(e) => handleUnitChange(unit.id, e.target.value)}
                                            className="unit-input hide-number-spinners"
                                            min="0"
                                            max={unit.currentCount}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {transportCapacity > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="text-lg font-bold">Transport Capacity</h4>
                            <div className="w-full bg-gray-700 rounded-full h-6 relative">
                                <div 
                                    className={`h-full rounded-full ${progressBarColor}`} 
                                    style={{ width: `${Math.min(100, capacityProgress)}%` }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                                    {currentUnitsLoad} / {transportCapacity}
                                </div>
                            </div>
                            {capacityProgress > 100 && (
                                <p className="text-red-500 text-sm mt-1">Over capacity!</p>
                            )}
                        </div>
                    )}

                    {mode === 'attack' && selectedLandUnitsForFormation.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="text-lg font-bold mb-2">Attack Formation</h4>
                            {attackLayerOptions.map(layer => (
                                <div key={layer.name} className="flex flex-col space-y-2 mt-2">
                                    <label>{layer.label}:</label>
                                    <select
                                        value={attackLayers[layer.name]}
                                        onChange={(e) => handleLayerChange(layer.name, e.target.value)}
                                        className="bg-gray-700 text-white rounded p-2"
                                    >
                                        <option value="">None</option>
                                        {selectedLandUnitsForFormation
                                            .filter(unitId => !Object.entries(attackLayers).some(([key, selectedUnit]) => selectedUnit === unitId && key !== layer.name))
                                            .map(unitId => (
                                                <option key={unitId} value={unitId}>{unitConfig[unitId].name}</option>
                                            ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                     {mode === 'attack' && selectedLandUnitsForFormation.length === 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <p className="text-gray-400">Select land units to configure attack formation.</p>
                        </div>
                    )}
                </div>
            );
        }
        if (mode === 'scout') {
            return (
                <ScoutPanel
                    selectedResources={selectedResources}
                    gameState={gameState}
                    handleResourceChange={handleResourceChange}
                />
            );
        }
        if (mode === 'trade') {
            return (
                <TradePanel
                    selectedResources={selectedResources}
                    currentResources={currentResources}
                    handleResourceChange={handleResourceChange}
                />
            );
        }
        return null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="movement-modal-container" onClick={e => e.stopPropagation()}>
                <h3 className="movement-modal-header capitalize">{mode} {targetCity ? targetCity.cityName || targetCity.name : ''}</h3>
                <div className="movement-modal-content">
                    {renderContent()}
                </div>
                <div className="movement-modal-footer">
                    <p className="mb-2">Travel Time: <span className="font-bold text-yellow-600">{finalTravelTime}</span></p>
                    {worldState?.weather && <WindInfo weather={worldState.weather} windSpeed={windSpeed} />}
                    <button onClick={handleSend} className="btn btn-primary w-full py-2 mt-4">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MovementModal;
