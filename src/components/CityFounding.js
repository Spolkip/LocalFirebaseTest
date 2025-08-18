// src/components/CityFounding.js
import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, writeBatch, collection, query, where, limit, getDocs, serverTimestamp} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import buildingConfig from '../gameData/buildings.json';

// #comment Add nations data for selection
const nationsByReligion = {
    'Greek': ['Athenian', 'Spartan', 'Corinthian'],
    'Roman': ['Julian', 'Cornelian', 'Fabian'],
    'Egyptian': ['Ptolemaic', 'Nubian', 'Bedouin']
};

const CityFounding = ({ onCityFounded }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, worldState, setActiveCityId, playerCities } = useGame();
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [cityName, setCityName] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // #comment Add state for religion and nation selection
    const [selectedReligion, setSelectedReligion] = useState(null);
    const [selectedNation, setSelectedNation] = useState(null);
    const [step, setStep] = useState(1); // 1 for selection, 2 for naming

    useEffect(() => {
        if (userProfile?.username) {
            setCityName(`${userProfile.username}'s Capital`);
        }
    }, [userProfile]);

    const findEmptySlot = useCallback(async () => {
        if (!worldState?.islands || !worldId) return null;
        const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
        const q = query(citySlotsRef, where('ownerId', '==', null), limit(10));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const randomDoc = querySnapshot.docs[Math.floor(Math.random() * querySnapshot.docs.length)];
                return { id: randomDoc.id, ...randomDoc.data() };
            }
        } catch (error) {
            console.error("Error finding an empty slot:", error);
        }
        return null;
    }, [worldId, worldState]);

    const handleProceedToNaming = useCallback(async () => {
        if (!selectedReligion || !selectedNation) {
            setMessage("Please select a religion and nation to continue.");
            return;
        }
        setIsLoading(true);
        setMessage('Finding a suitable location...');
        const slot = await findEmptySlot();
        if (slot) {
            setSelectedSlot(slot);
            setMessage(`Location found at (${slot.x}, ${slot.y}). Give your new city a name.`);
            setStep(2); // Move to the city naming step
        } else {
            setMessage('Could not find an available city slot. This world might be full.');
        }
        setIsLoading(false);
    }, [findEmptySlot, selectedReligion, selectedNation]);

    const handleFoundCity = async (e) => {
        e.preventDefault();
        if (!cityName.trim() || !selectedSlot || !userProfile || !selectedReligion || !selectedNation) {
            setMessage("Cannot found city: missing required information.");
            return;
        }
        setIsLoading(true);
        setMessage('Founding your city...');

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', selectedSlot.id);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const newCityDocRef = doc(collection(gameDocRef, 'cities'));

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("This location was taken. Please try again.");
            }

            const batch = writeBatch(db);

            // #comment Check for existing city names to avoid duplicates
            let baseName = cityName.trim();
            const existingCityNames = Object.values(playerCities).map(c => c.cityName);
            
            let finalCityName = baseName;
            if (existingCityNames.includes(finalCityName)) {
                let count = 2;
                let newName;
                const colonyBaseName = baseName.replace(/ Colony \d+$/, "").trim();
                do {
                    newName = `${colonyBaseName} Colony ${count}`;
                    count++;
                } while (existingCityNames.includes(newName));
                finalCityName = newName;
            }

            batch.update(citySlotRef, {
                ownerId: currentUser.uid,
                ownerUsername: userProfile.username,
                cityName: finalCityName
            });

            // #comment Set the top-level game document with initial data, including battle points
            batch.set(gameDocRef, {
                worldName: worldState.name,
                joinedAt: serverTimestamp(),
                citySlotIds: [selectedSlot.id],
                battlePoints: 0
            });

            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(id => {
                initialBuildings[id] = { level: 0 };
            });
            ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].forEach(id => {
                initialBuildings[id].level = 1;
            });

            const newCityData = {
                id: newCityDocRef.id,
                slotId: selectedSlot.id,
                x: selectedSlot.x,
                y: selectedSlot.y,
                islandId: selectedSlot.islandId,
                cityName: finalCityName,
                playerInfo: { religion: selectedReligion, nation: selectedNation },
                resources: { wood: 1000, stone: 1000, silver: 500 },
                buildings: initialBuildings,
                units: {},
                wounded: {},
                research: {},
                worship: {},
                cave: { silver: 0 },
                buildQueue: [],
                unitQueue: [],
                researchQueue: [],
                healQueue: [],
                lastUpdated: Date.now(),
            };
            
            batch.set(newCityDocRef, newCityData);

            await batch.commit();
            setActiveCityId(newCityDocRef.id);
            if (onCityFounded && typeof onCityFounded === 'function') {
                onCityFounded();
            }

        } catch (error) {
            console.error("Error founding city: ", error);
            setMessage(`Failed to found city: ${error.message}`);
            setSelectedSlot(null);
            setStep(1); // Go back to selection
            setIsLoading(false);
        }
    };

    if (step === 1) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gray-900 text-white">
                <div className="w-full max-w-2xl">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl">
                        <h1 className="font-title text-4xl text-center text-gray-300 mb-6">Choose Your Path</h1>
                        <p className="text-center text-gray-400 mb-8">Your choice of Religion and Nation will define your journey in this world.</p>
                        {message && <p className="text-center text-red-400 mb-4">{message}</p>}
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
                        <button onClick={handleProceedToNaming} disabled={!selectedReligion || !selectedNation || isLoading} className="w-full btn btn-confirm font-bold py-3 rounded-lg disabled:btn-disabled">
                             {isLoading ? 'Searching for land...' : 'Continue'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="w-full max-w-md text-center p-8 bg-gray-800 rounded-lg shadow-2xl">
                <h2 className="font-title text-4xl mb-4">Found Your First City</h2>
                <p className="text-gray-400 mb-6">{message}</p>
                {selectedSlot && (
                    <form onSubmit={handleFoundCity} className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={cityName}
                            onChange={(e) => setCityName(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-center text-lg"
                            required
                        />
                        <button type="submit" disabled={isLoading} className="btn btn-confirm px-8 py-3 text-lg">
                            {isLoading ? 'Claiming Land...' : 'Found City'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CityFounding;
