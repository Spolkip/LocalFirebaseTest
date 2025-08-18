// src/components/city/DivineTempleMenu.js
import React, { useState, useEffect } from 'react';
import unitConfig from '../../gameData/units.json';
import UnitQueue from './UnitQueue';
import Modal from '../shared/Modal';
import { useGame } from '../../contexts/GameContext';

const unitImages = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const UnitStats = ({ unit }) => (
    <div className="w-1/2 bg-gray-900 p-4 rounded-lg space-y-2">
        <h5 className="font-bold text-lg text-yellow-300 mb-3">Unit Information</h5>
        <div className="flex items-center justify-between text-sm"><span>⚔️ Attack</span><span className="font-bold">{unit.attack}</span></div>
        <div className="flex items-center justify-between text-sm"><span>🛡️ Defense</span><span className="font-bold">{unit.defense}</span></div>
        <div className="flex items-center justify-between text-sm"><span>🐎 Speed</span><span className="font-bold">{unit.speed}</span></div>
    </div>
);

const DivineTempleMenu = ({ resources, availablePopulation, onTrain, onClose, cityGameState, unitQueue, onCancelTrain }) => {
    const { gameState } = useGame();
    const worshippedGod = gameState?.god;

    // Filter units to only show mythical units associated with the worshipped god
    const mythicUnits = Object.keys(unitConfig).filter(id => unitConfig[id].mythical && unitConfig[id].god === worshippedGod);
    const [selectedUnitId, setSelectedUnitId] = useState(mythicUnits[0] || null);
    const [trainAmount, setTrainAmount] = useState('');
    
    useEffect(() => {
        setTrainAmount('');
    }, [selectedUnitId]);
    
    useEffect(() => {
        const availableUnits = Object.keys(unitConfig).filter(id => unitConfig[id].mythical && unitConfig[id].god === worshippedGod);
        setSelectedUnitId(availableUnits[0] || null);
    }, [worshippedGod]);

    if (!worshippedGod) {
        return <Modal message="You must worship a god to train mythical units." onClose={onClose} />;
    }
    
    if (!selectedUnitId) {
        return <Modal message={`There are no mythical units for your worshipped god, ${worshippedGod}.`} onClose={onClose} />;
    }

    const selectedUnit = unitConfig[selectedUnitId];
    const cityUnits = cityGameState?.units || {};
    const divineTempleUnitQueue = (unitQueue || []).filter(item => unitConfig[item.unitId]?.mythical);
    
    const numericTrainAmount = parseInt(trainAmount, 10) || 0;
    const totalCost = {
        wood: selectedUnit ? selectedUnit.cost.wood * numericTrainAmount : 0,
        stone: selectedUnit ? selectedUnit.cost.stone * numericTrainAmount : 0,
        silver: selectedUnit ? selectedUnit.cost.silver * numericTrainAmount : 0,
        population: selectedUnit ? selectedUnit.cost.population * numericTrainAmount : 0,
        favor: selectedUnit ? selectedUnit.cost.favor * numericTrainAmount : 0,
    };
    
    const currentFavor = cityGameState.worship?.[worshippedGod] || 0;

    const canAfford = resources.wood >= totalCost.wood &&
                    resources.stone >= totalCost.stone &&
                    resources.silver >= totalCost.silver &&
                    availablePopulation >= totalCost.population &&
                    currentFavor >= totalCost.favor;

    const handleTrain = () => {
        const amount = parseInt(trainAmount, 10) || 0;
        if (amount > 0) onTrain(selectedUnitId, amount);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Divine Temple</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                
                <div className="flex-grow flex gap-4 overflow-y-auto">
                    <div className="w-1/3 flex flex-col gap-2">
                        {mythicUnits.map(unitId => {
                            const unit = unitConfig[unitId];
                            const isSelected = selectedUnitId === unitId;
                            return (
                                <button
                                    key={unitId}
                                    onClick={() => setSelectedUnitId(unitId)}
                                    className={`flex items-center p-2 rounded border-2 transition-colors w-full ${isSelected ? 'bg-gray-600 border-yellow-500' : 'bg-gray-700 border-gray-600 hover:border-yellow-400'}`}
                                >
                                    <img src={unitImages[unit.image]} alt={unit.name} className="w-12 h-12 mr-3 object-contain" />
                                    <div>
                                        <p className="font-bold text-left text-white">{unit.name}</p>
                                        <p className="text-sm text-left text-gray-400">In City: {cityUnits[unitId] || 0}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="w-2/3 flex flex-col gap-4">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h4 className="font-title text-2xl text-yellow-400">{selectedUnit.name}</h4>
                            <p className="text-gray-400 italic mt-1">{selectedUnit.description}</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-1/2 bg-gray-900 p-4 rounded-lg space-y-1">
                                <h5 className="font-bold text-lg text-yellow-300 mb-2">Cost (Total)</h5>
                                <p className="text-sm text-gray-300">Wood: {selectedUnit.cost.wood} ({totalCost.wood})</p>
                                <p className="text-sm text-gray-300">Stone: {selectedUnit.cost.stone} ({totalCost.stone})</p>
                                <p className="text-sm text-gray-300">Silver: {selectedUnit.cost.silver} ({totalCost.silver})</p>
                                <p className="text-sm text-gray-300">Population: {selectedUnit.cost.population} ({totalCost.population})</p>
                                <p className="text-sm text-blue-300">Favor: {selectedUnit.cost.favor} ({totalCost.favor})</p>
                                <p className="text-sm text-gray-300">Time per unit: {selectedUnit.cost.time}s</p>
                            </div>
                            <UnitStats unit={selectedUnit} />
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <input
                                type="number"
                                value={trainAmount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || (parseInt(val) >= 0 && !val.includes('.'))) {
                                        setTrainAmount(val);
                                    }
                                }}
                                className="bg-gray-800 text-white rounded p-2 w-24"
                                placeholder="0"
                            />
                            <button
                                onClick={handleTrain}
                                disabled={!canAfford || numericTrainAmount === 0 || (divineTempleUnitQueue || []).length >= 5}
                                className={`py-2 px-6 text-lg rounded-lg btn ${(canAfford && numericTrainAmount > 0 && (divineTempleUnitQueue || []).length < 5) ? 'btn-confirm' : 'btn-disabled'}`}
                            >
                                {(divineTempleUnitQueue || []).length >= 5 ? 'Queue Full' : 'Train'}
                            </button>
                        </div>
                    </div>
                </div>

                <UnitQueue unitQueue={divineTempleUnitQueue} onCancel={(item) => onCancelTrain(item, 'divineTemple')} title="Mythical Unit Queue" />
            </div>
        </div>
    );
};

export default DivineTempleMenu;
