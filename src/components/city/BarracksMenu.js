// src/components/city/BarracksMenu.js
import React, { useState, useEffect, useMemo } from 'react';
import unitConfig from '../../gameData/units.json';
import UnitQueue from './UnitQueue';
import Modal from '../shared/Modal';
import { getTrainableUnits } from '../../utils/nationality';

// Dynamically import all unit images
const unitImages = {};
const imageContext = require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

// #comment A component to display unit stats in a clean, consistent way
const UnitStats = ({ unit }) => (
    <div className="w-1/2 bg-gray-900 p-4 rounded-lg space-y-2">
        <h5 className="font-bold text-lg text-yellow-300 mb-3">Unit Information</h5>
        <div className="flex items-center justify-between text-sm"><span>⚔️ Attack</span><span className="font-bold">{unit.attack}</span></div>
        <div className="flex items-center justify-between text-sm"><span>🛡️ Defense</span><span className="font-bold">{unit.defense}</span></div>
        <div className="flex items-center justify-between text-sm"><span>🐎 Speed</span><span className="font-bold">{unit.speed}</span></div>
    </div>
);

const BarracksMenu = ({ resources, availablePopulation, onTrain, onFire, onClose, cityGameState, unitQueue, onCancelTrain }) => {
    const [activeTab, setActiveTab] = useState('train');
    
    const landUnits = useMemo(() => getTrainableUnits(cityGameState.playerInfo.nation), [cityGameState.playerInfo.nation]);

    const [selectedUnitId, setSelectedUnitId] = useState(landUnits[0] || null);
    const [trainAmount, setTrainAmount] = useState('');
    const [fireAmounts, setFireAmounts] = useState({});
    
    useEffect(() => {
        setTrainAmount('');
    }, [selectedUnitId]);
    
    const cityUnits = cityGameState?.units || {};
    
    // #comment If there are no trainable land units for this nation, show a message.
    if (landUnits.length === 0) {
        return (
            <Modal message="Your nation has no specific land units that can be trained in the Barracks." onClose={onClose} />
        );
    }
    
    const selectedUnit = selectedUnitId ? unitConfig[selectedUnitId] : null;
    const barracksUnitQueue = (unitQueue || []).filter(item => unitConfig[item.unitId]?.type === 'land' && !unitConfig[item.unitId]?.mythical);
    
    const numericTrainAmount = parseInt(trainAmount, 10) || 0;
    const totalCost = {
        wood: selectedUnit ? selectedUnit.cost.wood * numericTrainAmount : 0,
        stone: selectedUnit ? selectedUnit.cost.stone * numericTrainAmount : 0,
        silver: selectedUnit ? selectedUnit.cost.silver * numericTrainAmount : 0,
        population: selectedUnit ? selectedUnit.cost.population * numericTrainAmount : 0,
    };
    
    const canAfford = resources.wood >= totalCost.wood &&
                    resources.stone >= totalCost.stone &&
                    resources.silver >= totalCost.silver &&
                    availablePopulation >= totalCost.population;

    const handleTrain = () => {
        const amount = parseInt(trainAmount, 10) || 0;
        if (amount > 0) onTrain(selectedUnitId, amount);
    };

    const handleFireAmountChange = (unitId, value) => {
        const max = cityUnits[unitId] || 0;
        const amount = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
        setFireAmounts(prev => ({ ...prev, [unitId]: amount }));
    };

    const handleFire = () => {
        const unitsToFire = Object.entries(fireAmounts).filter(([, amount]) => amount > 0);
        if (unitsToFire.length > 0) {
            if (typeof onFire === 'function') {
                onFire(Object.fromEntries(unitsToFire));
                setFireAmounts({});
            } else {
                console.error("BarracksMenu Error: onFire prop is not a function. It was not passed from the parent component.");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Barracks</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <div className="flex border-b border-gray-700 mb-4">
                    <button onClick={() => setActiveTab('train')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'train' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Train</button>
                    <button onClick={() => setActiveTab('fire')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'fire' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Dismiss</button>
                </div>

                {activeTab === 'train' && selectedUnit && (
                    <div className="flex-grow flex gap-4 overflow-y-auto">
                        <div className="w-1/3 flex flex-col gap-2">
                            {landUnits.map(unitId => {
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
                                    disabled={!canAfford || numericTrainAmount === 0 || (barracksUnitQueue || []).length >= 5}
                                    className={`py-2 px-6 text-lg rounded-lg btn ${(canAfford && numericTrainAmount > 0 && (barracksUnitQueue || []).length < 5) ? 'btn-confirm' : 'btn-disabled'}`}
                                >
                                    {(barracksUnitQueue || []).length >= 5 ? 'Queue Full' : 'Train'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'fire' && (
                    <div className="flex-grow overflow-y-auto pr-2">
                        <h4 className="text-xl font-semibold text-yellow-400 mb-2">Dismiss Units</h4>
                        {Object.keys(cityUnits).filter(id => unitConfig[id].type === 'land').length > 0 ? (
                            <div className="space-y-3">
                                {Object.entries(cityUnits).filter(([id]) => unitConfig[id].type === 'land').map(([unitId, count]) => {
                                    const unit = unitConfig[unitId];
                                    return (
                                        <div key={unitId} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <img src={unitImages[unit.image]} alt={unit.name} className="w-12 h-12 object-contain" />
                                                <div>
                                                    <p className="font-bold text-white">{unit.name}</p>
                                                    <p className="text-sm text-gray-400">In City: {count}</p>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                value={fireAmounts[unitId] || ''}
                                                onChange={(e) => handleFireAmountChange(unitId, e.target.value)}
                                                className="bg-gray-800 text-white rounded p-2 w-24 text-center"
                                                placeholder="Amount"
                                                max={count}
                                                min="0"
                                            />
                                        </div>
                                    );
                                })}
                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={handleFire}
                                        disabled={Object.values(fireAmounts).reduce((a, b) => a + b, 0) === 0}
                                        className="btn btn-danger py-2 px-6"
                                    >
                                        Dismiss Selected
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-8">No land units in the city to dismiss.</p>
                        )}
                    </div>
                )}

                <UnitQueue unitQueue={barracksUnitQueue} onCancel={(item) => onCancelTrain(item, 'barracks')} title="Land Unit Queue" />
            </div>
        </div>
    );
};

export default BarracksMenu;
