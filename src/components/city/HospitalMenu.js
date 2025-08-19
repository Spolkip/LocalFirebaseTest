// src/components/city/HospitalMenu.js
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import unitConfig from '../../gameData/units.json';
import UnitQueue from './UnitQueue';

const unitImages = {};
const imageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const HospitalMenu = ({ cityGameState, onClose, onHeal, onCancelHeal, getHospitalCapacity, availablePopulation }) => {
    const [healAmounts, setHealAmounts] = useState({});
    const woundedUnits = cityGameState.wounded || {};
    const hospitalLevel = cityGameState.buildings.hospital?.level || 0;
    const capacity = getHospitalCapacity(hospitalLevel);
    const totalWounded = Object.values(woundedUnits).reduce((sum, count) => sum + count, 0);

    const hospitalRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 1000) / 2,
        y: (window.innerHeight - 700) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('hospital-header') || e.target.parentElement.classList.contains('hospital-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);

    const handleAmountChange = (unitId, value) => {
        const max = woundedUnits[unitId] || 0;
        const amount = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
        setHealAmounts(prev => ({ ...prev, [unitId]: amount }));
    };

    const totalCost = useMemo(() => {
        return Object.entries(healAmounts).reduce((acc, [unitId, amount]) => {
            const unit = unitConfig[unitId];
            if (unit && unit.heal_cost) {
                acc.wood += (unit.heal_cost.wood || 0) * amount;
                acc.stone += (unit.heal_cost.stone || 0) * amount;
                acc.silver += (unit.heal_cost.silver || 0) * amount;
            }
            return acc;
        }, { wood: 0, stone: 0, silver: 0 });
    }, [healAmounts]);
    
    const populationCost = useMemo(() => {
        return Object.entries(healAmounts).reduce((acc, [unitId, amount]) => {
            const unit = unitConfig[unitId];
            if (unit) {
                acc += (unit.cost.population || 0) * amount;
            }
            return acc;
        }, 0);
    }, [healAmounts]);

    const canAfford = cityGameState.resources.wood >= totalCost.wood &&
                      cityGameState.resources.stone >= totalCost.stone &&
                      cityGameState.resources.silver >= totalCost.silver;
    const hasEnoughPopulation = availablePopulation >= populationCost;

    const handleHeal = () => {
        const unitsToHeal = Object.entries(healAmounts).filter(([, amount]) => amount > 0);
        if (unitsToHeal.length > 0) {
            onHeal(Object.fromEntries(unitsToHeal));
            setHealAmounts({});
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div
                ref={hospitalRef}
                className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border-2 border-gray-600 flex flex-col max-h-[90vh] hospital-container"
                onClick={e => e.stopPropagation()}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="flex justify-between items-center mb-4 hospital-header" onMouseDown={handleMouseDown}>
                    <h3 className="font-title text-3xl text-white">Hospital (Level {hospitalLevel})</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <p className="text-gray-400 mb-4">Capacity: {totalWounded} / {capacity}</p>
                <div className="flex-grow overflow-y-auto pr-2">
                    <h4 className="text-xl font-semibold text-yellow-400 mb-2">Wounded Units</h4>
                    {Object.keys(woundedUnits).length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(woundedUnits).map(([unitId, count]) => {
                                if (count === 0) return null;
                                const unit = unitConfig[unitId];
                                return (
                                    <div key={unitId} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <img src={unitImages[unit.image]} alt={unit.name} className="w-12 h-12 object-contain" />
                                            <div>
                                                <p className="font-bold text-white">{unit.name}</p>
                                                <p className="text-sm text-gray-400">Wounded: {count}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={healAmounts[unitId] || ''}
                                                onChange={(e) => handleAmountChange(unitId, e.target.value)}
                                                className="bg-gray-800 text-white rounded p-2 w-24 text-center"
                                                placeholder="Amount"
                                                max={count}
                                                min="0"
                                            />
                                            <div className="text-xs text-gray-300">
                                                <p>Cost/unit:</p>
                                                <p>W: {unit.heal_cost.wood}, S: {unit.heal_cost.stone}, Ag: {unit.heal_cost.silver}</p>
                                                <p>Time/unit: {unit.heal_time}s</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">No wounded units.</p>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold text-lg">Total Cost:</p>
                            <p className="text-sm text-gray-300">
                                Wood: {totalCost.wood}, Stone: {totalCost.stone}, Silver: {totalCost.silver}
                            </p>
                            <p className="text-sm text-gray-300">
                                Population: <span className={hasEnoughPopulation ? 'text-green-400' : 'text-red-400'}>{populationCost} / {availablePopulation}</span>
                            </p>
                        </div>
                        <button
                            onClick={handleHeal}
                            disabled={!canAfford || !hasEnoughPopulation || Object.values(healAmounts).reduce((sum, val) => sum + val, 0) === 0 || (cityGameState.healQueue || []).length >= 5}
                            className={`py-2 px-6 text-lg rounded-lg btn ${canAfford && hasEnoughPopulation && Object.values(healAmounts).reduce((sum, val) => sum + val, 0) > 0 && (cityGameState.healQueue || []).length < 5 ? 'btn-confirm' : 'btn-disabled'}`}
                        >
                            { (cityGameState.healQueue || []).length >= 5 ? 'Queue Full' : (!hasEnoughPopulation ? 'Not Enough Pop.' : 'Heal Selected') }
                        </button>
                    </div>
                </div>
                <UnitQueue 
                    unitQueue={cityGameState.healQueue || []} 
                    onCancel={onCancelHeal} 
                    title="Healing"
                />
            </div>
        </div>
    );
};
export default HospitalMenu;
