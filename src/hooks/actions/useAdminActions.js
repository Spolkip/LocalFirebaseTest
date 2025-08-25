import { collection, doc, query, where, limit, getDocs, setDoc as firestoreSetDoc, runTransaction, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';
import { generateGodTowns } from '../../utils/worldGeneration';
import researchConfig from '../../gameData/research.json';
import buildingConfig from '../../gameData/buildings.json';
import { clearProfileCache } from '../../components/profile/ProfileView';
import { clearMemberCache } from '../../components/alliance/AllianceMembers';
import { clearLeaderboardCache } from '../../components/leaderboard/Leaderboard';

export const useAdminActions = ({
    userProfile, worldId, cityGameState, currentUser,
    setIsInstantBuild, setIsInstantResearch, setIsInstantUnits,
    saveGameState, setMessage
}) => {
    const { worldState, playerCities } = useGame();

    const handleSpawnGodTown = async () => {
        if (!userProfile?.is_admin || !worldState) {
            setMessage("You are not authorized or world data is not loaded.");
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
            await firestoreSetDoc(townDocRef, townData);

            setMessage(`God Town spawned as "Strange Ruins" at (${townData.x}, ${townData.y})!`);
        } catch (error) {
            console.error("Error spawning God Town:", error);
            setMessage(`Failed to spawn God Town: ${error.message}`);
        }
    };

    const handleCheat = async (amounts, troop, farmLevels, warehouseLevels, isInstantBuild, unresearchId, isInstantResearch, isInstantUnits, favorAmount, foundSecondCity, forceRefresh, healHero) => {
        if (!cityGameState || !userProfile?.is_admin) return;

        // #comment Handle the new force refresh action
        if (forceRefresh) {
            clearProfileCache();
            clearMemberCache();
            clearLeaderboardCache();
            setMessage("All data caches have been cleared successfully!");
            return;
        }

        if (foundSecondCity) {
            if (!worldId) {
                setMessage("Cannot found city: World ID is missing.");
                console.error("worldId is missing in handleCheat");
                return;
            }
            setMessage('Finding a suitable location for your new city...');

            const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
            const q = query(citySlotsRef, where('ownerId', '==', null), limit(10));
            let selectedSlot = null;
            try {
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const randomDoc = querySnapshot.docs[Math.floor(Math.random() * querySnapshot.docs.length)];
                    selectedSlot = { id: randomDoc.id, ...randomDoc.data() };
                }
            } catch (error) {
                console.error("Error finding an empty slot:", error);
                setMessage('Error finding a location.');
                return;
            }

            if (!selectedSlot) {
                setMessage('Could not find an available city slot. This world might be full.');
                return;
            }

            setMessage(`Location found at (${selectedSlot.x}, ${selectedSlot.y}). Founding city...`);

            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', selectedSlot.id);
            const newCityDocRef = doc(collection(db, 'users', currentUser.uid, 'games', worldId, 'cities'));

            try {
                await runTransaction(db, async (transaction) => {
                    const slotSnap = await transaction.get(citySlotRef);
                    if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                        throw new Error("This location was taken while processing. Please try again.");
                    }

                    const existingCityNames = Object.values(playerCities).map(c => c.cityName);

                    const baseName = `${userProfile.username}'s Colony`;
                    let finalCityName = baseName;

                    if (existingCityNames.includes(finalCityName)) {
                        let count = 2;
                        let newName;
                        do {
                            newName = `${baseName} ${count}`;
                            count++;
                        } while (existingCityNames.includes(newName));
                        finalCityName = newName;
                    }

                    transaction.update(citySlotRef, {
                        ownerId: currentUser.uid,
                        ownerUsername: userProfile.username,
                        cityName: finalCityName
                    });

                    const initialBuildings = {};
                    Object.keys(buildingConfig).forEach(id => {
                        initialBuildings[id] = { level: 0 };
                    });
                    ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].forEach(id => {
                        initialBuildings[id] = { level: 1 };
                    });

                    const newCityData = {
                        id: newCityDocRef.id,
                        slotId: selectedSlot.id,
                        x: selectedSlot.x,
                        y: selectedSlot.y,
                        islandId: selectedSlot.islandId,
                        cityName: finalCityName,
                        playerInfo: cityGameState.playerInfo,
                        resources: { wood: 1000, stone: 1000, silver: 500 },
                        buildings: initialBuildings,
                        units: {},
                        wounded: {},
                        research: {},
                        worship: {},
                        cave: { silver: 0 },
                        buildQueue: [],
                        barracksQueue: [],
                        shipyardQueue: [],
                        divineTempleQueue: [],
                        healQueue: [],
                        lastUpdated: Date.now(),
                    };

                    transaction.set(newCityDocRef, newCityData);
                });
                setMessage(`New city founded successfully!`);
            } catch (error) {
                console.error("Error founding city with cheat: ", error);
                setMessage(`Failed to found city: ${error.message}`);
            }
            return;
        }

        if (healHero) {
            const batch = writeBatch(db);
            const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
            const citiesSnap = await getDocs(citiesRef);
            let heroHealed = false;

            citiesSnap.forEach(cityDoc => {
                const cityData = cityDoc.data();
                if (cityData.heroes) {
                    for (const heroId in cityData.heroes) {
                        if (cityData.heroes[heroId].woundedUntil) {
                            // Use deleteField to remove the woundedUntil timestamp
                            batch.update(cityDoc.ref, { [`heroes.${heroId}.woundedUntil`]: deleteField() });
                            heroHealed = true;
                        }
                    }
                }
            });

            if (heroHealed) {
                try {
                    await batch.commit();
                    setMessage("Wounded hero has been healed!");
                } catch (error) {
                    setMessage(`Error healing hero: ${error.message}`);
                    console.error(error);
                }
            } else {
                setMessage("No wounded hero found to heal.");
            }
        }

        setIsInstantBuild(isInstantBuild);
        setIsInstantResearch(isInstantResearch);
        setIsInstantUnits(isInstantUnits);

        const newGameState = { ...cityGameState };
        newGameState.resources.wood += amounts.wood;
        newGameState.resources.stone += amounts.stone;
        newGameState.resources.silver += amounts.silver;

        if (farmLevels > 0) {
            newGameState.buildings.farm.level = farmLevels;
        }
        if (troop.amount > 0) {
            newGameState.units[troop.unit] = (newGameState.units[troop.unit] || 0) + troop.amount;
        }
        if (warehouseLevels > 0) {
            newGameState.buildings.warehouse.level = warehouseLevels;
        }
        if (unresearchId && newGameState.research[unresearchId]) {
            delete newGameState.research[unresearchId];
            setMessage(`Research "${researchConfig[unresearchId]?.name}" unreasearched!`);
        } else if (unresearchId) {
            setMessage(`Research "${researchConfig[unresearchId]?.name}" is not researched.`);
        }
        if (favorAmount > 0 && newGameState.god) {
            const currentFavor = newGameState.worship[newGameState.god] || 0;
            const templeLevel = newGameState.buildings.temple?.level || 0;
            const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
            newGameState.worship[newGameState.god] = Math.min(maxFavor, currentFavor + favorAmount);
            setMessage(`Added ${favorAmount} favor to ${newGameState.god}!`);
        } else if (favorAmount > 0 && !newGameState.god) {
            setMessage("No god is currently worshipped to add favor.");
        }

        // Only save game state if other cheats were applied, as healHero is handled separately.
        if (Object.values(amounts).some(v => v > 0) || troop.amount > 0 || farmLevels > 0 || warehouseLevels > 0 || unresearchId || favorAmount > 0) {
            await saveGameState(newGameState);
            setMessage("Admin cheat applied!");
        }
    };

    return { handleSpawnGodTown, handleCheat };
};
