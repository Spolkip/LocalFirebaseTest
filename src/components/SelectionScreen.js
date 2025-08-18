// src/components/SelectionScreen.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { doc, runTransaction, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from '../firebase/config';
import Modal from './shared/Modal';
import buildingConfig from '../gameData/buildings.json';

const nationsByReligion = {
    'Greek': ['Athenian', 'Spartan', 'Corinthian'],
    'Roman': ['Julian', 'Cornelian', 'Fabian'],
    'Egyptian': ['Ptolemaic', 'Nubian', 'Bedouin']
};

const SelectionScreen = () => {
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const { worldState } = useGame();
    const [selectedReligion, setSelectedReligion] = useState(null);
    const [selectedNation, setSelectedNation] = useState(null);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const placeNewCity = async (userId, userEmail, username, religion, nation) => {
        if (!worldState || !worldState.id) {
            setMessage("World data is not loaded correctly.");
            return;
        }

        const worldId = worldState.id;
        const citySlotsCollectionRef = collection(db, 'worlds', worldId, 'citySlots');
        
        let claimed = false;
        let attempts = 0;
        const maxAttempts = 5;
        const fetchLimit = 10; // Fetch more empty slots at once

        while (!claimed && attempts < maxAttempts) {
            attempts++;
            // Capture the current value of 'attempts' for this iteration
            const currentAttempt = attempts; 

            let availableSlots = [];
            try {
                // Fetch a batch of available slots
                const q = query(citySlotsCollectionRef, where("ownerId", "==", null), limit(fetchLimit));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    setMessage("This world is full! No empty city slots are available.");
                    return; // No slots found, exit
                }
                availableSlots = querySnapshot.docs;
            } catch (error) {
                console.error(`Error fetching empty slots (attempt ${currentAttempt}):`, error);
                setMessage(`Failed to find a location due to a technical issue. Retrying... (${currentAttempt}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt)); // Use currentAttempt here
                continue; // Try fetching again
            }

            // Try to claim one of the fetched slots
            for (const emptySlotDoc of availableSlots) {
                const emptySlotRef = emptySlotDoc.ref;
                try {
                    await runTransaction(db, async (transaction) => {
                        const slotSnap = await transaction.get(emptySlotRef);
                        if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                            // This slot was taken, throw to try the next one in the list
                            throw new Error("Slot was already taken. Trying another...");
                        }

                        const newCityName = `${username}'s Landing`;
                        const faction = `${nation} (${religion})`;
                        transaction.update(emptySlotRef, {
                            ownerId: userId,
                            ownerEmail: userEmail,
                            ownerUsername: username,
                            cityName: newCityName,
                            ownerFaction: faction
                        });

                        const gameDocRef = doc(db, `users/${userId}/games`, worldId);
                        
                        const initialBuildings = {};
                        // All buildings from config start at level 0
                        for (const buildingId in buildingConfig) {
                            initialBuildings[buildingId] = { level: 0 };
                        }
                        // Set specific buildings to level 1
                        initialBuildings.senate = { level: 1 };
                        initialBuildings.farm = { level: 1 };
                        initialBuildings.warehouse = { level: 1 };
                        initialBuildings.timber_camp = { level: 1 };
                        initialBuildings.quarry = { level: 1 };
                        initialBuildings.silver_mine = { level: 1 };

                        const newGameState = {
                            cityName: newCityName,
                            playerInfo: { religion, nation },
                            resources: { wood: 500, stone: 500, silver: 100 },
                            buildings: initialBuildings,
                            units: {},
                            cave: { silver: 0 },
                            lastUpdated: Date.now(), 
                            cityLocation: {
                                mapId: worldId,
                                slotId: emptySlotDoc.id,
                                islandId: slotSnap.data().islandId
                            }
                        };
                        transaction.set(gameDocRef, newGameState);
                    });
                    claimed = true; // Successfully claimed a slot, exit outer loop
                    console.log("Transaction successful: City placed!");
                    return; // Exit the function after successful claim
                } catch (e) {
                    console.warn(`Failed to claim slot ${emptySlotDoc.id}: ${e.message}`);
                    // Continue to next slot in availableSlots array
                }
            }
            if (!claimed && currentAttempt < maxAttempts) { // Use currentAttempt here
                setMessage(`Failed to claim any of the found slots. Retrying to find new ones... (${currentAttempt}/${maxAttempts})`); // Use currentAttempt here
                await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt)); // Use currentAttempt here
            }
        }

        if (!claimed) {
            setMessage(`Could not place your city after ${maxAttempts} attempts. The world might be full or under heavy load. Please try again later.`);
        }
    };

    const handleConfirm = async () => {
        if (!selectedReligion || !selectedNation) {
            setMessage("Please select both a religion and a nation.");
            return;
        }
        if (authLoading || !userProfile || !userProfile.username) {
            setMessage("User profile is not loaded yet. Please wait a moment and try again.");
            return;
        }
        setIsSubmitting(true);
        setMessage("Founding your first city...");
        await placeNewCity(currentUser.uid, currentUser.email, userProfile.username, selectedReligion, selectedNation);
        setIsSubmitting(false);
    };

    const isButtonDisabled = !selectedReligion || !selectedNation || isSubmitting || authLoading;

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4">
             <Modal message={message} onClose={() => setMessage('')} />
            <div className="w-full max-w-2xl">
                <div className="bg-gray-800 p-8 rounded-lg shadow-2xl">
                    <h1 className="font-title text-4xl text-center text-gray-300 mb-6">Choose Your Path</h1>
                    <p className="text-center text-gray-400 mb-8">Your choice of Religion and Nation will define your journey in this world.</p>
                    <div className="mb-8">
                        <h2 className="font-title text-2xl text-gray-300 mb-4">Select Religion</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.keys(nationsByReligion).map(religion => (
                                <div key={religion} onClick={() => { setSelectedReligion(religion); setSelectedNation(null); }} className={`selection-card p-4 rounded-lg text-center ${selectedReligion === religion ? 'selected' : ''}`}>
                                    <h3 className="text-xl font-bold">{religion}</h3>
                                </div>
                            ))}
                        </div>
                    </div>
                    {selectedReligion && (
                        <div className="mb-8">
                            <h2 className="font-title text-2xl text-gray-300 mb-4">Select Nation</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {nationsByReligion[selectedReligion].map(nation => (
                                    <div key={nation} onClick={() => setSelectedNation(nation)} className={`selection-card p-4 rounded-lg text-center ${selectedNation === nation ? 'selected' : ''}`}>
                                        <h3 className="text-xl font-bold">{nation}</h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <button onClick={handleConfirm} disabled={isButtonDisabled} className="w-full btn btn-confirm font-bold py-3 rounded-lg disabled:btn-disabled">
                         {isSubmitting ? 'Founding City...' : (authLoading ? 'Loading Profile...' : 'Found My Empire')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectionScreen;