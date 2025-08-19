import React, { useState, useEffect } from 'react';
import unitConfigData from '../../gameData/units.json';
import researchConfigData from '../../gameData/research.json';
import buildingConfigData from '../../gameData/buildings.json';
import godsConfigData from '../../gameData/gods.json';
import questsConfigData from '../../gameData/quests.json';
import puzzlesConfigData from '../../gameData/puzzles.json';
import allianceWondersData from '../../gameData/alliance_wonders.json';
import allianceResearchData from '../../gameData/allianceResearch.json';
import heroesData from '../../gameData/heroes.json';
import ruinsResearchData from '../../gameData/ruinsResearch.json';
import specialBuildingsData from '../../gameData/specialBuildings.json';

import './managementPanel.css';

// #comment A generic component for an editable field
const EditableField = ({ label, value, onChange, type = 'text', options }) => (
    <div className="flex flex-col mb-2">
        <label className="text-sm font-semibold mb-1">{label}</label>
        {type === 'textarea' ? (
            <textarea value={value} onChange={onChange} className="p-1 rounded bg-white/20 border border-amber-700" rows="3" />
        ) : type === 'select' ? (
            <select value={value} onChange={onChange} className="p-1 rounded bg-white/20 border border-amber-700">
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : type === 'checkbox' ? (
            <input type="checkbox" checked={!!value} onChange={onChange} className="w-6 h-6" />
        ) : (
            <input type={type} value={value} onChange={onChange} className="p-1 rounded bg-white/20 border border-amber-700" />
        )}
    </div>
);

// #comment A component to edit a nested object, like 'cost' or 'rewards'
const ObjectEditor = ({ data, onChange, title, typeOptions = {} }) => {
    // #comment If data is null or undefined, don't render the component to prevent errors.
    if (!data) {
        return null;
    }

    const handleValueChange = (key, value) => {
        const newData = { ...data };
        newData[key] = isNaN(parseFloat(value)) ? value : parseFloat(value);
        onChange(newData);
    };

    return (
        <div className="p-2 border border-amber-700 rounded mt-2">
            <h4 className="font-bold text-center">{title}</h4>
            {Object.entries(data).map(([key, value]) => {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    return (
                        <div key={key} className="mt-2">
                            <h5 className="font-semibold capitalize text-center">{key}</h5>
                            {Object.entries(value).map(([subKey, subValue]) => (
                                <div key={subKey} className="flex items-center justify-between my-1">
                                    <label className="text-sm capitalize">{subKey.replace(/([A-Z])/g, ' $1')}</label>
                                    <input
                                        type="number"
                                        value={subValue}
                                        onChange={(e) => {
                                            const newSubObject = { ...value, [subKey]: isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value) };
                                            onChange({ ...data, [key]: newSubObject });
                                        }}
                                        className="w-24 p-1 rounded bg-white/20 border border-amber-700 text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    );
                }
                // #comment If type options are provided for this key, render a dropdown
                if (key === 'type' && typeOptions[title]) {
                    return (
                        <div key={key} className="flex items-center justify-between my-1">
                            <label className="text-sm capitalize">Type</label>
                            <select value={value} onChange={(e) => handleValueChange(key, e.target.value)} className="p-1 rounded bg-white/20 border border-amber-700">
                                {typeOptions[title].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    );
                }
                return (
                    <div key={key} className="flex items-center justify-between my-1">
                        <label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                        <input
                            type={typeof value === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => handleValueChange(key, e.target.value)}
                            className="w-24 p-1 rounded bg-white/20 border border-amber-700 text-right"
                        />
                    </div>
                );
            })}
        </div>
    );
};


// #comment A component to edit an array of strings, like 'counters'
const ArrayEditor = ({ data, onChange, title, options }) => {
    const handleAddItem = () => {
        if (options && options.length > 0) {
            onChange([...(data || []), options[0]]);
        }
    };

    const handleItemChange = (index, newValue) => {
        const newData = [...data];
        newData[index] = newValue;
        onChange(newData);
    };

    const handleRemoveItem = (index) => {
        const newData = [...data];
        newData.splice(index, 1);
        onChange(newData);
    };

    return (
        <div className="p-2 border border-amber-700 rounded mt-2">
            <h4 className="font-bold text-center">{title}</h4>
            {(data || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2 my-1">
                    <select value={item} onChange={(e) => handleItemChange(index, e.target.value)} className="flex-grow p-1 rounded bg-white/20 border border-amber-700">
                        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <button onClick={() => handleRemoveItem(index)} className="btn-danger text-xs px-2 py-1 rounded">-</button>
                </div>
            ))}
            <button onClick={handleAddItem} className="btn-confirm w-full text-xs mt-2 py-1">Add</button>
        </div>
    );
};

// #comment A component for editing an array of complex objects, like a god's powers or hero's skills
const ComplexArrayEditor = ({ data, onChange, title, type, typeOptions }) => {
    const handleItemChange = (index, field, value) => {
        const newItems = [...data];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange(newItems);
    };

    const handleNestedChange = (index, topField, value) => {
        const newItems = [...data];
        try {
            newItems[index][topField] = JSON.parse(value);
            onChange(newItems);
        } catch (e) {
            console.error(`Invalid JSON for ${topField}:`, e);
        }
    };

    const handleEffectChange = (index, newEffect) => {
        const newItems = [...data];
        newItems[index] = { ...newItems[index], effect: newEffect };
        onChange(newItems);
    };

    const handleAddItem = () => {
        const newItem = type === 'powers' 
            ? { name: "New Power", description: "", favorCost: 0, effect: {} }
            : { name: "New Skill", type: "battle", description: "", cost: { favor: { base: 10, perLevel: 1 } }, cooldown: 3600, icon: "", effect: {} };
        onChange([...(data || []), newItem]);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...data];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    return (
        <div className="p-2 border border-amber-700 rounded mt-2">
            <h4 className="font-bold text-center">{title}</h4>
            {(data || []).map((item, index) => (
                <div key={index} className="p-2 my-2 border-b border-amber-600 relative">
                    <button onClick={() => handleRemoveItem(index)} className="absolute top-0 right-0 btn-danger text-xs px-2 py-1 rounded">-</button>
                    <EditableField label="Name" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} />
                    <EditableField label="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} type="textarea" />
                    {type === 'powers' && <EditableField label="Favor Cost" value={item.favorCost} onChange={(e) => handleItemChange(index, 'favorCost', parseInt(e.target.value) || 0)} type="number" />}
                    {type === 'skills' && <EditableField label="Type" value={item.type} onChange={(e) => handleItemChange(index, 'type', e.target.value)} type="select" options={['battle', 'city']} />}
                    {type === 'skills' && <EditableField label="Cost (JSON)" value={JSON.stringify(item.cost, null, 2)} onChange={(e) => handleNestedChange(index, 'cost', e.target.value)} type="textarea" />}
                    
                    {/* #comment Use ObjectEditor for effects in skills */}
                    {type === 'skills' ? 
                        <ObjectEditor data={item.effect} onChange={(val) => handleEffectChange(index, val)} title="Effect/Bonus" typeOptions={typeOptions} />
                        :
                        <EditableField label="Effect (JSON)" value={JSON.stringify(item.effect, null, 2)} onChange={(e) => handleNestedChange(index, 'effect', e.target.value)} type="textarea" />
                    }
                </div>
            ))}
            <button onClick={handleAddItem} className="btn-confirm w-full text-xs mt-2 py-1">Add {type === 'powers' ? 'Power' : 'Skill'}</button>
        </div>
    );
};

// #comment Modal for creating a new game data item
const NewItemModal = ({ onConfirm, onCancel, dataType }) => {
    const [newItemId, setNewItemId] = useState('');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-gray-800 p-6 rounded-lg text-white w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Add New {dataType}</h3>
                <input
                    type="text"
                    value={newItemId}
                    onChange={(e) => setNewItemId(e.target.value)}
                    placeholder="Enter a unique ID (e.g., new_unit)"
                    className="w-full bg-gray-700 p-2 rounded mb-4 text-white"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                    <button onClick={() => onConfirm(newItemId)} className="btn btn-confirm">Create</button>
                </div>
            </div>
        </div>
    );
};

// #comment The main component for editing all game data
const GameDataEditor = ({ dataType }) => {
    const [data, setData] = useState(() => {
        // #comment Pre-process troop data to ensure heal_cost and heal_time exist for all units
        const troopsWithDefaults = { ...unitConfigData };
        for (const unitId in troopsWithDefaults) {
            if (typeof troopsWithDefaults[unitId].heal_cost !== 'object' || troopsWithDefaults[unitId].heal_cost === null) {
                troopsWithDefaults[unitId].heal_cost = { wood: 0, stone: 0, silver: 0 };
            }
            if (typeof troopsWithDefaults[unitId].heal_time === 'undefined') {
                troopsWithDefaults[unitId].heal_time = 0;
            }
        }
        return {
            troops: troopsWithDefaults,
            buildings: buildingConfigData,
            research: researchConfigData,
            gods: godsConfigData,
            quests: questsConfigData,
            puzzles: puzzlesConfigData,
            alliance_wonders: allianceWondersData,
            alliance_research: allianceResearchData,
            heroes: heroesData,
            ruinsResearch: ruinsResearchData,
            specialBuildings: specialBuildingsData,
        };
    });
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedGodReligion, setSelectedGodReligion] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    useEffect(() => {
        setSelectedItemId(null);
        setSelectedGodReligion(null);
    }, [dataType]);

    const activeData = data[dataType];
    const selectedItem = selectedItemId ? (dataType === 'gods' ? activeData[selectedGodReligion]?.[selectedItemId] : activeData[selectedItemId]) : null;

    const handleSave = () => {
        console.log("Updated Game Data:", JSON.stringify(data, null, 2));
        alert("Game data saved to console! Refresh the page to see changes in other parts of the UI.");
    };

    const handleSelect = (id) => {
        setSelectedItemId(id);
    };

    const handleFieldChange = (field, value) => {
        if (dataType === 'gods') {
            const newData = { ...data };
            newData.gods[selectedGodReligion][selectedItemId][field] = value;
            setData(newData);
        } else {
            const newActiveData = { ...activeData };
            newActiveData[selectedItemId][field] = value;
            setData(prev => ({ ...prev, [dataType]: newActiveData }));
        }
    };
    
    const handleAddNewItem = (newItemId) => {
        if (!newItemId.trim()) {
            alert("ID cannot be empty.");
            return;
        }
        if (activeData[newItemId]) {
            alert("An item with this ID already exists.");
            return;
        }

        let newItem = {};
        switch (dataType) {
            case 'troops':
                newItem = { name: "New Unit", description: "", cost: { wood: 10, stone: 10, silver: 10, population: 1, time: 10 }, heal_cost: { wood: 3, stone: 3, silver: 3 }, heal_time: 5, attack: 5, defense: 5, speed: 5, type: "land", counters: [] };
                break;
            case 'buildings':
                newItem = { name: "New Building", description: "", baseCost: { wood: 50, stone: 50, silver: 50, population: 5, time: 60 }, maxLevel: 10, points: 5 };
                break;
            case 'research':
                newItem = { name: "New Research", description: "", cost: { wood: 100, stone: 100, silver: 100, time: 300, points: 10 }, requirements: { academy: 1 } };
                break;
            case 'quests':
                newItem = { title: "New Quest", description: "", type: "building", targetId: "senate", targetLevel: 2, rewards: { resources: { wood: 50 } } };
                break;
            case 'puzzles':
                newItem = { question: "New Question?", answer: "Answer" };
                break;
            case 'gods':
                if (!selectedGodReligion) {
                    alert("Please select a religion first.");
                    return;
                }
                newItem = { name: "New God", description: "", powers: [], mythical_units: [], image: "" };
                const newData = { ...data };
                newData.gods[selectedGodReligion][newItemId] = newItem;
                setData(newData);
                setIsAddingNew(false);
                setSelectedItemId(newItemId);
                return;
            case 'heroes':
                newItem = { name: "New Hero", description: "", image: "", cost: { silver: 1000, favor: 50 }, maxLevel: 10, xpPerLevel: [100], levelUpCost: { silver: 100, favor: 10 }, passive: { name: "Passive", description: "", effect: {} }, skills: [] };
                break;
            case 'alliance_wonders':
                newItem = { name: "New Wonder", description: "", bonus: { type: "", value: 0 }, image: "" };
                break;
            case 'alliance_research':
                newItem = { name: "New Research", description: "", maxLevel: 5, baseCost: { wood: 1000, stone: 1000, silver: 1000 }, costMultiplier: 1.5, effect: { type: "", value: 0 } };
                break;
            case 'ruinsResearch':
                newItem = { name: "New Ruin Research", description: "", effect: { type: "", value: 0 } };
                break;
            case 'specialBuildings':
                newItem = { name: "New Special Building", description: "", bonus: { type: "", value: 0 }, image: "" };
                break;
            default:
                break;
        }

        setData(prev => ({ ...prev, [dataType]: { ...prev[dataType], [newItemId]: newItem } }));
        setIsAddingNew(false);
        setSelectedItemId(newItemId);
    };
    
    const typeOptions = {
        'Effect': ['unit_speed_land', 'build_time', 'unit_attack_ranged', 'unit_speed_naval', 'unit_defense_hoplite', 'speed_boost_all', 'transport_capacity_boost', 'scout_power_boost'],
        'Effect/Bonus': [
            'attack_boost', 'defense_boost', 'speed_boost', 'max_members', 
            'bank_capacity', 'naval_boost', 'land_boost', 'mythic_boost', 
            'population_boost', 'trade_boost', 'research_boost', 'fortification_boost', 
            'morale_boost', 'trade_efficiency', 'production_boost_wood', 'production_boost_stone',
            'production_boost_silver', 'donation_cooldown_reduction', 'donation_limit_increase',
            'village_demand_boost', 'cave_capacity_boost', 'warehouse_capacity_boost',
            'favor_production_boost', 'unit_training_speed_boost', 'city_buff', 'troop_buff'
        ],
    };

    const renderEditor = () => {
        if (!selectedItem) return <div className="text-center p-8">Select an item to edit.</div>;

        switch (dataType) {
            case 'troops':
                return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <EditableField label="Type" value={selectedItem.type} onChange={(e) => handleFieldChange('type', e.target.value)} type="select" options={['land', 'naval']} />
                        <EditableField label="Flying" value={selectedItem.flying} onChange={(e) => handleFieldChange('flying', e.target.checked)} type="checkbox" />
                        <EditableField label="Attack" value={selectedItem.attack} onChange={(e) => handleFieldChange('attack', parseInt(e.target.value) || 0)} type="number" />
                        <EditableField label="Defense" value={selectedItem.defense} onChange={(e) => handleFieldChange('defense', parseInt(e.target.value) || 0)} type="number" />
                        <EditableField label="Speed" value={selectedItem.speed} onChange={(e) => handleFieldChange('speed', parseInt(e.target.value) || 0)} type="number" />
                        <ObjectEditor data={selectedItem.cost} onChange={(val) => handleFieldChange('cost', val)} title="Cost" />
                        <ObjectEditor data={selectedItem.heal_cost} onChange={(val) => handleFieldChange('heal_cost', val)} title="Heal Cost" />
                        <EditableField label="Heal Time" value={selectedItem.heal_time} onChange={(e) => handleFieldChange('heal_time', parseInt(e.target.value) || 0)} type="number" />
                        <ArrayEditor data={selectedItem.counters || []} onChange={(val) => handleFieldChange('counters', val)} title="Counters" options={Object.keys(data.troops)} />
                    </div>
                );
            case 'buildings':
                 return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <ObjectEditor data={selectedItem.baseCost} onChange={(val) => handleFieldChange('baseCost', val)} title="Base Cost" />
                        {selectedItem.requirements && <ObjectEditor data={selectedItem.requirements} onChange={(val) => handleFieldChange('requirements', val)} title="Requirements" />}
                    </div>
                );
            case 'research':
                return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <ObjectEditor data={selectedItem.cost} onChange={(val) => handleFieldChange('cost', val)} title="Cost" />
                        <ObjectEditor data={selectedItem.effect} onChange={(val) => handleFieldChange('effect', val)} title="Effect" typeOptions={typeOptions} />
                        {selectedItem.requirements && <ObjectEditor data={selectedItem.requirements} onChange={(val) => handleFieldChange('requirements', val)} title="Requirements" />}
                    </div>
                );
            case 'gods':
                return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <ComplexArrayEditor data={selectedItem.powers || []} onChange={(val) => handleFieldChange('powers', val)} title="Powers" type="powers" />
                        <ArrayEditor data={selectedItem.mythical_units || []} onChange={(val) => handleFieldChange('mythical_units', val)} title="Mythical Units" options={Object.keys(data.troops)} />
                    </div>
                );
            case 'quests':
                return (
                     <div className="p-2">
                        <EditableField label="Title" value={selectedItem.title} onChange={(e) => handleFieldChange('title', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <EditableField label="Type" value={selectedItem.type} onChange={(e) => handleFieldChange('type', e.target.value)} type="select" options={['building', 'units']} />
                        <EditableField label="Target ID" value={selectedItem.targetId} onChange={(e) => handleFieldChange('targetId', e.target.value)} />
                        <EditableField label="Target Level/Count" value={selectedItem.targetLevel || selectedItem.targetCount} onChange={(e) => handleFieldChange(selectedItem.targetLevel ? 'targetLevel' : 'targetCount', parseInt(e.target.value))} type="number" />
                        <ObjectEditor data={selectedItem.rewards} onChange={(val) => handleFieldChange('rewards', val)} title="Rewards" />
                    </div>
                );
            case 'puzzles':
                 return (
                    <div className="p-2">
                        <EditableField label="Question" value={selectedItem.question} onChange={(e) => handleFieldChange('question', e.target.value)} type="textarea" />
                        <EditableField label="Answer" value={selectedItem.answer} onChange={(e) => handleFieldChange('answer', e.target.value)} />
                    </div>
                );
             case 'heroes':
                const handlePassiveChange = (field, value) => {
                    const newPassive = { ...selectedItem.passive, [field]: value };
                    handleFieldChange('passive', newPassive);
                };

                return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <ObjectEditor data={selectedItem.cost} onChange={(val) => handleFieldChange('cost', val)} title="Recruit Cost" />
                        <ObjectEditor data={selectedItem.levelUpCost} onChange={(val) => handleFieldChange('levelUpCost', val)} title="Level Up Cost" />
                        
                        <div className="p-2 border border-amber-700 rounded mt-2">
                            <h4 className="font-bold text-center">Passive Skill</h4>
                            <EditableField label="Passive Name" value={selectedItem.passive.name} onChange={(e) => handlePassiveChange('name', e.target.value)} />
                            <EditableField label="Passive Description" value={selectedItem.passive.description} onChange={(e) => handlePassiveChange('description', e.target.value)} type="textarea" />
                            <ObjectEditor data={selectedItem.passive.effect} onChange={(val) => handlePassiveChange('effect', val)} title="Effect/Bonus" typeOptions={typeOptions} />
                        </div>

                        <ComplexArrayEditor data={selectedItem.skills || []} onChange={(val) => handleFieldChange('skills', val)} title="Active Skills" type="skills" typeOptions={typeOptions}/>
                    </div>
                );
            case 'alliance_wonders':
            case 'specialBuildings':
            case 'ruinsResearch':
            case 'alliance_research':
                return (
                    <div className="p-2">
                        <EditableField label="Name" value={selectedItem.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        <EditableField label="Description" value={selectedItem.description} onChange={(e) => handleFieldChange('description', e.target.value)} type="textarea" />
                        <ObjectEditor data={selectedItem.effect || selectedItem.bonus} onChange={(val) => handleFieldChange(selectedItem.effect ? 'effect' : 'bonus', val)} title="Effect/Bonus" typeOptions={typeOptions} />
                        {selectedItem.baseCost && <ObjectEditor data={selectedItem.baseCost} onChange={(val) => handleFieldChange('baseCost', val)} title="Base Cost" />}
                    </div>
                );
            default:
                return <p>Editor not implemented for this type.</p>;
        }
    };
    
    const renderList = () => {
        if (dataType === 'gods') {
            if (!selectedGodReligion) {
                return Object.keys(activeData).map(religion => (
                    <div key={religion} onClick={() => setSelectedGodReligion(religion)} className="p-2 cursor-pointer hover:bg-amber-200/50 capitalize">
                        {religion}
                    </div>
                ));
            }
            return (
                <>
                    <button onClick={() => setSelectedGodReligion(null)} className="p-2 font-bold hover:bg-amber-200/50 w-full text-left">← Back to Religions</button>
                    <button onClick={() => setIsAddingNew(true)} className="p-2 font-bold text-green-600 hover:bg-green-200/50 w-full text-left">New God...</button>
                    {Object.entries(activeData[selectedGodReligion]).map(([godId, godData]) => (
                         <div key={godId} onClick={() => handleSelect(godId)} className={`p-2 cursor-pointer hover:bg-amber-200/50 ${selectedItemId === godId ? 'bg-amber-300/50' : ''}`}>
                            {godData.name}
                        </div>
                    ))}
                </>
            );
        }

        return (
            <>
                <button onClick={() => setIsAddingNew(true)} className="p-2 font-bold text-green-600 hover:bg-green-200/50 w-full text-left">New...</button>
                {Object.entries(activeData).map(([id, item]) => (
                    <div key={id} onClick={() => handleSelect(id)} className={`p-2 cursor-pointer hover:bg-amber-200/50 ${selectedItemId === id ? 'bg-amber-300/50' : ''}`}>
                        {item.name || item.title || id}
                    </div>
                ))}
            </>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {isAddingNew && <NewItemModal onConfirm={handleAddNewItem} onCancel={() => setIsAddingNew(false)} dataType={dataType} />}
            <div className="flex-grow flex overflow-hidden">
                <div className="w-1/3 border-r-2 border-[#8B4513] overflow-y-auto">
                    {renderList()}
                </div>
                <div className="w-2/3 overflow-y-auto">
                    {renderEditor()}
                </div>
            </div>
            <button onClick={handleSave} className="w-full py-2 mt-2 btn-confirm">Save All Game Data</button>
        </div>
    );
};

const ManagementPanel = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('troops');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="management-panel-container" onClick={e => e.stopPropagation()}>
                <div className="management-panel-header">
                    <h2>Imperial Manager</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="management-tabs">
                    <button onClick={() => setActiveTab('troops')} className={activeTab === 'troops' ? 'active' : ''}>Troops</button>
                    <button onClick={() => setActiveTab('buildings')} className={activeTab === 'buildings' ? 'active' : ''}>Buildings</button>
                    <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                    <button onClick={() => setActiveTab('gods')} className={activeTab === 'gods' ? 'active' : ''}>Gods</button>
                    <button onClick={() => setActiveTab('quests')} className={activeTab === 'quests' ? 'active' : ''}>Quests</button>
                    <button onClick={() => setActiveTab('puzzles')} className={activeTab === 'puzzles' ? 'active' : ''}>Puzzles</button>
                    <button onClick={() => setActiveTab('heroes')} className={activeTab === 'heroes' ? 'active' : ''}>Heroes</button>
                    <button onClick={() => setActiveTab('alliance_wonders')} className={activeTab === 'alliance_wonders' ? 'active' : ''}>Alliance Wonders</button>
                    <button onClick={() => setActiveTab('alliance_research')} className={activeTab === 'alliance_research' ? 'active' : ''}>Alliance Research</button>
                    <button onClick={() => setActiveTab('ruinsResearch')} className={activeTab === 'ruinsResearch' ? 'active' : ''}>Ruins Research</button>
                    <button onClick={() => setActiveTab('specialBuildings')} className={activeTab === 'specialBuildings' ? 'active' : ''}>Special Buildings</button>
                </div>
                <div className="management-content">
                    <GameDataEditor dataType={activeTab} />
                </div>
            </div>
        </div>
    );
};

export default ManagementPanel;