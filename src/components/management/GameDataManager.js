// src/components/management/GameDataManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';

// Import base data
import baseUnits from '../../gameData/units.json';
import baseBuildings from '../../gameData/buildings.json';
import baseResearch from '../../gameData/research.json';
import baseQuests from '../../gameData/quests.json';
import baseGods from '../../gameData/gods.json';

// #comment A generic hook to manage game data from Firestore, with a fallback to local JSON
const useGameData = (dataType, baseData) => {
    const { worldId } = useGame();
    const [data, setData] = useState(baseData);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!worldId) return;
            setLoading(true);
            const docRef = doc(db, 'worlds', worldId, 'gameData', dataType);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Merge Firestore data with base data to ensure new units from JSON are available
                setData(prevData => ({ ...prevData, ...docSnap.data() }));
            }
            setLoading(false);
        };
        fetchData();
    }, [worldId, dataType]);

    const saveData = async (newData) => {
        if (!worldId) return;
        const docRef = doc(db, 'worlds', worldId, 'gameData', dataType);
        await setDoc(docRef, newData, { merge: true });
        setData(prev => ({...prev, ...newData}));
    };

    return { data, loading, saveData };
};

// #comment Manager for editing troop data
export const TroopDataManager = () => {
    const { data: troops, loading, saveData } = useGameData('units', baseUnits);
    const [selectedUnitId, setSelectedUnitId] = useState(Object.keys(baseUnits)[0]);
    const [editedUnit, setEditedUnit] = useState(null);

    useEffect(() => {
        if (troops && selectedUnitId) {
            setEditedUnit(JSON.parse(JSON.stringify(troops[selectedUnitId]))); // Deep copy
        }
    }, [troops, selectedUnitId]);

    const handleInputChange = (e, field, subfield = null) => {
        const { value, type } = e.target;
        const parsedValue = type === 'number' ? parseFloat(value) : value;

        setEditedUnit(prev => {
            const newUnit = { ...prev };
            if (subfield) {
                newUnit[field] = { ...newUnit[field], [subfield]: parsedValue };
            } else {
                newUnit[field] = parsedValue;
            }
            return newUnit;
        });
    };

    const handleSave = async () => {
        await saveData({ [selectedUnitId]: editedUnit });
        alert('Troop data saved!');
    };

    if (loading) return <div>Loading troop data...</div>;
    if (!editedUnit) return <div>Select a unit to edit.</div>;

    return (
        <div className="space-y-4">
            <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)} className="w-full p-2 rounded bg-amber-200">
                {Object.keys(troops).sort((a,b) => troops[a].name.localeCompare(troops[b].name)).map(id => <option key={id} value={id}>{troops[id].name}</option>)}
            </select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label>Name</label><input className="w-full p-1" value={editedUnit.name} onChange={e => handleInputChange(e, 'name')} /></div>
                <div className="md:col-span-2"><label>Description</label><textarea className="w-full p-1" value={editedUnit.description} onChange={e => handleInputChange(e, 'description')} /></div>
                
                <h4 className="md:col-span-2 font-bold text-lg mt-2">Cost</h4>
                {Object.keys(editedUnit.cost || {}).map(res => (
                     <div key={res}><label className="capitalize">{res}</label><input type="number" className="w-full p-1" value={editedUnit.cost[res]} onChange={e => handleInputChange(e, 'cost', res)} /></div>
                ))}

                <h4 className="md:col-span-2 font-bold text-lg mt-2">Stats</h4>
                <div><label>Attack</label><input type="number" className="w-full p-1" value={editedUnit.attack} onChange={e => handleInputChange(e, 'attack')} /></div>
                <div><label>Defense</label><input type="number" className="w-full p-1" value={editedUnit.defense} onChange={e => handleInputChange(e, 'defense')} /></div>
                <div><label>Speed</label><input type="number" className="w-full p-1" value={editedUnit.speed} onChange={e => handleInputChange(e, 'speed')} /></div>

            </div>

            <button onClick={handleSave} className="papyrus-btn mt-4">Save {editedUnit.name}</button>
        </div>
    );
};

// #comment Placeholder for Building Data Manager
export const BuildingDataManager = () => {
    const { data: buildings, loading } = useGameData('buildings', baseBuildings);
    if (loading) return <div>Loading...</div>;
    return <div>Building Data Manager - Coming Soon!</div>;
};

// #comment Placeholder for Research Data Manager
export const ResearchDataManager = () => {
    const { data: research, loading } = useGameData('research', baseResearch);
    if (loading) return <div>Loading...</div>;
    return <div>Research Data Manager - Coming Soon!</div>;
};

// #comment Placeholder for Quest Data Manager
export const QuestDataManager = () => {
    const { data: quests, loading } = useGameData('quests', baseQuests);
    if (loading) return <div>Loading...</div>;
    return <div>Quest Data Manager - Coming Soon!</div>;
};

// #comment Placeholder for God Data Manager
export const GodDataManager = () => {
    const { data: gods, loading } = useGameData('gods', baseGods);
    if (loading) return <div>Loading...</div>;
    return <div>God Data Manager - Coming Soon!</div>;
};
