import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import BuildQueue from './BuildQueue';
import './SenateView.css'; // Import the new CSS file

const buildingImages = {};
const contexts = [
    require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/)
];
contexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        buildingImages[key] = context(item);
    });
});

// #comment A reusable confirmation modal
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
        <div className="bg-gray-800 p-6 rounded-lg text-white">
            <p className="mb-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                <button onClick={onConfirm} className="btn btn-danger">Confirm</button>
            </div>
        </div>
    </div>
);

// #comment Component to manage workers in production buildings
const WorkerManager = ({ buildings, onAddWorker, onRemoveWorker, getMaxWorkerSlots, availablePopulation }) => {
    const productionBuildings = ['timber_camp', 'quarry', 'silver_mine'];
    return (
        <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-xl font-bold font-title text-yellow-300 mb-3 text-center">Worker Management</h3>
            <div className="space-y-3">
                {productionBuildings.map(id => {
                    const building = buildings[id];
                    if (!building || building.level === 0) return null;
                    const workers = building.workers || 0;
                    const maxWorkers = getMaxWorkerSlots(building.level);
                    return (
                        <div key={id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-white">{buildingConfig[id].name}</h4>
                                <p className="text-sm text-gray-400">Workers: {workers} / {maxWorkers}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onRemoveWorker(id)}
                                    disabled={workers <= 0}
                                    className="btn btn-danger w-8 h-8 flex items-center justify-center text-lg"
                                >-</button>
                                <button
                                    onClick={() => onAddWorker(id)}
                                    disabled={workers >= maxWorkers || availablePopulation < 20}
                                    className="btn btn-confirm w-8 h-8 flex items-center justify-center text-lg"
                                >+</button>
                            </div>
                        </div>
                    );
                })}
            </div>
             <p className="text-xs mt-2 text-gray-400 text-center">Each worker costs 20 population.</p>
        </div>
    );
};

const PresetManager = ({ presets, selectedPresetId, setSelectedPresetId, handleApplyPreset, setIsSavingPreset, handleDeletePreset }) => {
    const selectedPreset = presets.find(p => p.id === selectedPresetId);
    return (
        <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-xl font-bold font-title text-yellow-300 mb-3 text-center">Worker Presets</h3>
            <div className="flex items-center gap-2">
                <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded w-full"
                >
                    <option value="">Select a Preset</option>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={handleApplyPreset} disabled={!selectedPresetId} className="btn btn-primary text-sm py-2 px-3 flex-shrink-0">Apply</button>
                <button onClick={() => setIsSavingPreset(true)} disabled={presets.length >= 3} className="btn btn-primary text-sm py-2 px-3 flex-shrink-0" title={presets.length >= 3 ? "Maximum of 3 presets reached" : "Save current layout"}>Save</button>
                <button onClick={handleDeletePreset} disabled={!selectedPresetId} className="btn btn-danger text-sm py-2 px-3 flex-shrink-0">Delete</button>
            </div>
            {selectedPreset && (
                <div className="mt-4 p-2 bg-gray-800 rounded-lg max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-center mb-2">Preset Workers</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {selectedPreset.workers && Object.entries(selectedPreset.workers)
                            .sort(([idA], [idB]) => buildingConfig[idA].name.localeCompare(buildingConfig[idB].name))
                            .map(([id, count]) => (
                                <div key={id} className="flex justify-between">
                                    <span>{buildingConfig[id].name}</span>
                                    <span className="font-bold">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const BuildingCard = ({ id, config, level, finalQueuedLevel, cost, canAfford, onUpgrade, isQueueFull, isMaxLevel }) => {
    let buttonText;
    if (level === 0 && finalQueuedLevel === 0) {
        buttonText = 'Build';
    } else {
        buttonText = `Expand to ${finalQueuedLevel + 1}`;
    }
    if (isMaxLevel) buttonText = 'Max Level';
    let disabledReason = '';
    if (isMaxLevel) disabledReason = 'Max Level';
    else if (isQueueFull) disabledReason = 'Queue Full';
    else if (!canAfford) disabledReason = 'Not enough resources/pop';

    return (
        <div className="bg-gray-700/80 border-2 border-gray-600 rounded-lg p-2 w-48 text-center flex flex-col items-center relative shadow-lg">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gray-500/50"></div>
            <h4 className="font-bold text-yellow-400 text-base">{config.name}</h4>
            <p className="text-sm text-gray-300 font-semibold">
                Level {level} {finalQueuedLevel > level ? `(-> ${finalQueuedLevel})` : ''}
            </p>
            <img src={buildingImages[config.image]} alt={config.name} className="w-20 h-20 object-contain my-1" />
            <div className="text-xs text-gray-400 mb-2">
                <span>{cost.wood}W</span>, <span>{cost.stone}S</span>, <span>{cost.silver}Ag</span>, <span>{cost.population}P</span>
            </div>
            <button
                onClick={() => onUpgrade(id)}
                disabled={!canAfford || isQueueFull || isMaxLevel}
                className={`w-full py-1.5 rounded font-bold text-sm transition-colors ${!canAfford || isQueueFull || isMaxLevel ? 'btn-disabled' : 'btn-upgrade'}`}
            >
                {disabledReason || buttonText}
            </button>
        </div>
    );
};

const SpecialBuildingCard = ({ cityGameState, onOpenSpecialBuildingMenu }) => {
    const specialBuildingId = cityGameState.specialBuilding;
    const config = specialBuildingId ? specialBuildingsConfig[specialBuildingId] : buildingConfig.special_building_plot;
    return (
        <div className="bg-gray-700/80 border-2 border-gray-600 rounded-lg p-2 w-48 text-center flex flex-col items-center relative shadow-lg">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gray-500/50 z-0"></div>
            <h4 className="font-bold text-yellow-400 text-base">{config.name}</h4>
            <p className="text-sm text-gray-300 font-semibold">{specialBuildingId ? 'Constructed' : 'Empty Plot'}</p>
            <img src={buildingImages[config.image]} alt={config.name} className="w-20 h-20 object-contain my-1" />
            <p className="text-xs text-gray-400 mb-2 h-8 overflow-hidden">{config.description}</p>
            <button
                onClick={onOpenSpecialBuildingMenu}
                disabled={!!specialBuildingId}
                className={`w-full py-1.5 rounded font-bold text-sm transition-colors ${!!specialBuildingId ? 'btn-disabled' : 'btn-upgrade'}`}
            >
                {specialBuildingId ? 'Constructed' : 'Build Wonder'}
            </button>
        </div>
    );
};

const SenateView = ({ buildings, resources, onUpgrade, onDemolish, getUpgradeCost, onClose, usedPopulation, maxPopulation, buildQueue = [], onCancelBuild, onCompleteInstantly, setMessage, cityGameState, onOpenSpecialBuildingMenu, onDemolishSpecialBuilding, currentUser, worldId, onAddWorker, onRemoveWorker, getMaxWorkerSlots, availablePopulation, onApplyWorkerPreset }) => {
    const [activeTab, setActiveTab] = useState('upgrade');
    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const senateRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 1000) / 2,
        y: (window.innerHeight - 650) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('senate-header') || e.target.parentElement.classList.contains('senate-header')) {
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
    

    const buildingRows = [
        ['senate'],
        ['timber_camp', 'quarry', 'silver_mine', 'farm'],
        ['warehouse', 'market', 'barracks', 'shipyard'],
        ['academy', 'temple', 'divine_temple', 'hospital'],
        ['city_wall', 'cave', 'prison', 'heroes_altar'],
        ['special_building_plot']
    ];

    // #comment Fetch user's building presets
    useEffect(() => {
        if (!currentUser || !worldId) return;
        const presetsRef = collection(db, `users/${currentUser.uid}/games/${worldId}/presets`);
        const unsubscribe = onSnapshot(presetsRef, (snapshot) => {
            const presetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPresets(presetsData);
        });
        return () => unsubscribe();
    }, [currentUser, worldId]);

    const getFinalLevelInQueue = (buildingId) => {
        let finalLevel = buildings[buildingId]?.level || 0;
        const tasksForBuilding = (buildQueue || []).filter(task => task.buildingId === buildingId && task.type !== 'demolish');
        const demolishTasks = (buildQueue || []).filter(task => task.buildingId === buildingId && task.type === 'demolish');
        if (tasksForBuilding.length > 0) {
            finalLevel = Math.max(...tasksForBuilding.map(t => t.level));
        }
        if(demolishTasks.length > 0) {
            finalLevel = Math.min(...demolishTasks.map(t => t.level));
        }
        return finalLevel;
    };

    const handleSavePreset = async () => {
        if (!newPresetName.trim()) {
            setMessage("Please enter a name for the preset.");
            return;
        }
        const presetId = newPresetName.trim().toLowerCase().replace(/\s+/g, '-');
        const presetDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/presets`, presetId);
        const existingPreset = presets.find(p => p.id === presetId);
        if (presets.length >= 3 && !existingPreset) {
            setMessage("You can only have a maximum of 3 presets. Delete one to save a new one.");
            setIsSavingPreset(false);
            return;
        }

        const onConfirmSave = async () => {
            const currentWorkers = {};
            const productionBuildings = ['timber_camp', 'quarry', 'silver_mine'];
            productionBuildings.forEach(id => {
                currentWorkers[id] = buildings[id]?.workers || 0;
            });
            const presetData = {
                name: newPresetName.trim(),
                workers: currentWorkers
            };
            await setDoc(presetDocRef, presetData);
            setNewPresetName('');
            setIsSavingPreset(false);
            setSelectedPresetId(presetId);
            setConfirmAction(null);
            setMessage(`Preset '${presetData.name}' saved successfully!`);
        };

        if (existingPreset) {
            setConfirmAction({
                message: `A preset named "${newPresetName.trim()}" already exists. Do you want to overwrite it?`,
                onConfirm: onConfirmSave
            });
        } else {
            await onConfirmSave();
        }
    };

    // #comment Delete the selected preset after confirmation
    const handleDeletePreset = async () => {
        if (!selectedPresetId) return;
        const presetName = presets.find(p => p.id === selectedPresetId)?.name;
        setConfirmAction({
            message: `Are you sure you want to delete the preset "${presetName}"?`,
            onConfirm: async () => {
                const presetDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/presets`, selectedPresetId);
                await deleteDoc(presetDocRef);
                setSelectedPresetId('');
                setConfirmAction(null);
                setMessage(`Preset '${presetName}' deleted.`);
            }
        });
    };

    // #comment Apply worker distribution from the selected preset
    const handleApplyPreset = () => {
        const selectedPreset = presets.find(p => p.id === selectedPresetId);
        if (!selectedPreset) {
            setMessage("Please select a preset to apply.");
            return;
        }
        onApplyWorkerPreset(selectedPreset);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-30">
            {confirmAction && (
                <ConfirmationModal
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            {isSavingPreset && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <h3 className="text-lg font-bold mb-4 text-white">Save Worker Preset</h3>
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="Enter preset name..."
                            className="w-full bg-gray-700 p-2 rounded mb-4 text-white"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsSavingPreset(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleSavePreset} className="btn btn-confirm">Save</button>
                        </div>
                    </div>
                </div>
            )}
            <div
                ref={senateRef}
                className="senate-view-container text-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="flex justify-between items-center border-b border-gray-600 pb-3 mb-4 senate-header">
                    <h2 className="text-3xl font-bold font-title text-yellow-300">Senate</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <BuildQueue buildQueue={buildQueue} onCancel={onCancelBuild} onCompleteInstantly={onCompleteInstantly} />
                <div className='flex justify-between items-center mb-4 p-3 bg-gray-900 rounded-lg'>
                    <p className="text-lg">Population: <span className="font-bold text-green-400">{availablePopulation}</span> / {maxPopulation}</p>
                    <div className="flex gap-4">
                        <p>Wood: <span className='font-bold text-yellow-300'>{Math.floor(resources.wood)}</span></p>
                        <p>Stone: <span className='font-bold text-gray-300'>{Math.floor(resources.stone)}</span></p>
                        <p>Silver: <span className='font-bold text-blue-300'>{Math.floor(resources.silver)}</span></p>
                    </div>
                </div>
                <div className="flex border-b border-gray-600 mb-4">
                    <button onClick={() => setActiveTab('upgrade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'upgrade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Upgrade</button>
                    <button onClick={() => setActiveTab('demolish')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'demolish' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Demolish</button>
                    <button onClick={() => setActiveTab('management')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'management' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Management</button>
                </div>
                <div className="overflow-y-auto pr-2">
                    {activeTab === 'upgrade' && (
                        <div className="flex flex-col items-center space-y-12 py-6">
                            {buildingRows.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex justify-center items-start gap-6 relative">
                                    {row.length > 1 && rowIndex > 0 && <div className="absolute -top-9 left-0 right-0 h-0.5 bg-gray-500/50 z-0 w-3/4 mx-auto"></div>}
                                    {row.map(id => {
                                        if (id === 'special_building_plot') {
                                            return <SpecialBuildingCard key={id} cityGameState={cityGameState} onOpenSpecialBuildingMenu={onOpenSpecialBuildingMenu} />;
                                        }
                                        const config = buildingConfig[id];
                                        if (config.constructible === false && id !== 'senate') return null;
                                        const currentLevel = buildings[id]?.level || 0;
                                        const finalQueuedLevel = getFinalLevelInQueue(id);
                                        const nextLevelToBuild = finalQueuedLevel + 1;
                                        const isMaxLevel = finalQueuedLevel >= (config.maxLevel || 99);
                                        const cost = getUpgradeCost(id, nextLevelToBuild);
                                        let canAfford = resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver;
                                        if (id !== 'farm' && id !== 'warehouse') {
                                            canAfford = canAfford && (maxPopulation - usedPopulation >= cost.population);
                                        }
                                        const isQueueFull = (buildQueue || []).length >= 5;
                                        return (
                                            <BuildingCard
                                                key={id}
                                                id={id}
                                                config={config}
                                                level={currentLevel}
                                                finalQueuedLevel={finalQueuedLevel}
                                                cost={cost}
                                                canAfford={canAfford}
                                                onUpgrade={onUpgrade}
                                                isQueueFull={isQueueFull}
                                                isMaxLevel={isMaxLevel}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'demolish' && (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(buildings)
                                .filter(([id, data]) => data.level > 0 && buildingConfig[id].constructible !== false && id !== 'senate')
                                .map(([id, data]) => {
                                    const config = buildingConfig[id];
                                    const finalLevel = getFinalLevelInQueue(id);
                                    const canDemolish = finalLevel > 0;
                                    const isQueueFull = (buildQueue || []).length >= 5;
                                    let buttonText = 'Demolish';
                                    if (finalLevel > 1) {
                                        buttonText = `Demolish to Lvl ${finalLevel - 1}`;
                                    }
                                    return (
                                        <div key={id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                            <div>
                                                <h4 className="text-xl font-semibold text-yellow-400">{config.name}</h4>
                                                <p className="text-sm text-gray-300">Level {data.level}</p>
                                            </div>
                                            <button
                                                onClick={() => onDemolish(id)}
                                                disabled={!canDemolish || isQueueFull}
                                                className={`py-2 px-4 rounded font-bold ${!canDemolish || isQueueFull ? 'btn-disabled' : 'btn-danger'}`}
                                            >
                                                {isQueueFull ? 'Queue Full' : !canDemolish ? 'At Lvl 0' : buttonText}
                                            </button>
                                        </div>
                                    );
                                })
                            }
                            {cityGameState.specialBuilding && (
                                <div className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <h4 className="text-xl font-semibold text-yellow-400">{specialBuildingsConfig[cityGameState.specialBuilding].name}</h4>
                                        <p className="text-sm text-gray-300">Wonder</p>
                                    </div>
                                    <button
                                        onClick={onDemolishSpecialBuilding}
                                        className="py-2 px-4 rounded font-bold btn-danger"
                                    >
                                        Demolish
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                     {activeTab === 'management' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                            <WorkerManager
                                buildings={buildings}
                                onAddWorker={onAddWorker}
                                onRemoveWorker={onRemoveWorker}
                                getMaxWorkerSlots={getMaxWorkerSlots}
                                availablePopulation={availablePopulation}
                            />
                            <PresetManager
                                presets={presets}
                                selectedPresetId={selectedPresetId}
                                setSelectedPresetId={setSelectedPresetId}
                                handleApplyPreset={handleApplyPreset}
                                setIsSavingPreset={setIsSavingPreset}
                                handleDeletePreset={handleDeletePreset}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SenateView;