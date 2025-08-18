// src/components/admin/EventTrigger.js
import React, { useState } from 'react';
import { db } from '../../firebase/config';
import { collection, doc, setDoc, getDocs, query, where, limit, updateDoc, deleteDoc } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import { generateGodTowns } from '../../utils/worldGeneration';

const EventTrigger = ({ onClose }) => {
    const { worldState, worldId } = useGame();
    const [message, setMessage] = useState('');

    const handleSpawnGodTown = async () => {
        if (!worldState) {
            setMessage("World data is not loaded.");
            return;
        }
        setMessage("Spawning a God Town...");
        try {
            const newTowns = generateGodTowns(worldState.islands, worldState.width, worldState.height, 1);
            if (Object.keys(newTowns).length === 0) {
                throw new Error("Failed to find a suitable location in the sea. Try again.");
            }
            const [townId, townData] = Object.entries(newTowns)[0];

            const townDocRef = doc(db, 'worlds', worldId, 'godTowns', townId);
            await setDoc(townDocRef, townData);

            setMessage(`God Town spawned as "Strange Ruins" at (${townData.x}, ${townData.y})!`);
        } catch (error) {
            console.error("Error spawning God Town:", error);
            setMessage(`Failed to spawn God Town: ${error.message}`);
        }
    };

    const handleTransformRuins = async () => {
        setMessage("Searching for ruins to transform...");
        try {
            const godTownsRef = collection(db, 'worlds', worldId, 'godTowns');
            const q = query(godTownsRef, where('stage', '==', 'ruins'), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setMessage("No God Town ruins found to transform.");
                return;
            }

            const ruinDoc = querySnapshot.docs[0];
            await updateDoc(ruinDoc.ref, { 
                stage: 'city',
                name: 'City of the Gods'
            });
            setMessage(`Ruins at (${ruinDoc.data().x}, ${ruinDoc.data().y}) transformed into a city!`);

        } catch (error) {
            console.error("Error transforming ruins:", error);
            setMessage(`Failed to transform ruins: ${error.message}`);
        }
    };

    const handleDespawnGodTown = async () => {
        setMessage("Searching for a God Town to despawn...");
        try {
            const godTownsRef = collection(db, 'worlds', worldId, 'godTowns');
            const q = query(godTownsRef, limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setMessage("No God Towns found to despawn.");
                return;
            }

            const townDoc = querySnapshot.docs[0];
            await deleteDoc(townDoc.ref);
            setMessage(`God Town at (${townDoc.data().x}, ${townDoc.data().y}) has been despawned.`);

        } catch (error) {
            console.error("Error despawning God Town:", error);
            setMessage(`Failed to despawn God Town: ${error.message}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Admin Event Triggers</h3>
                {message && <p className="text-center text-yellow-400 mb-4">{message}</p>}
                <div className="space-y-4">
                    <button onClick={handleSpawnGodTown} className="btn btn-primary w-full py-2 bg-purple-600 hover:bg-purple-500">
                        Spawn God Town Event
                    </button>
                    <button onClick={handleTransformRuins} className="btn btn-primary w-full py-2 bg-green-600 hover:bg-green-500">
                        Instantly Transform Ruins
                    </button>
                    <button onClick={handleDespawnGodTown} className="btn btn-danger w-full py-2">
                        Despawn God Town Event
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventTrigger;
