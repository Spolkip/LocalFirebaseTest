// src/contexts/GameContext.js
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { doc, onSnapshot, collection, writeBatch, updateDoc, getDoc } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { calculateTotalPointsForCity } from '../hooks/useCityState';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser } = useAuth();
    const { addNotification } = useNotification();
    const [playerGameData, setPlayerGameData] = useState(null);
    const [playerCities, setPlayerCities] = useState({});
    const [activeCityId, setActiveCityId] = useState(null);
    const [worldState, setWorldState] = useState(null);
    const [playerHasCities, setPlayerHasCities] = useState(false);
    const [loading, setLoading] = useState(true);
    const [conqueredVillages, setConqueredVillages] = useState({});
    const [conqueredRuins, setConqueredRuins] = useState({});
    const [playerCityPoints, setPlayerCityPoints] = useState({}); // State for player's city points
    const [gameSettings, setGameSettings] = useState({
        animations: true,
        confirmActions: true,
        showGrid: true,
        showVisuals: true,
        hideReturningReports: false,
        hideCompletedQuestsIcon: false,
        workerPresets: {
            timber_camp: 0,
            quarry: 0,
            silver_mine: 0,
        }
    });
    const [isInstantBuild, setIsInstantBuild] = useState(() => {
        return localStorage.getItem("isInstantBuild") === "true" // restore on refresh
    });
    const [isInstantResearch, setIsInstantResearch] = useState(() => {
        return localStorage.getItem("isInstantResearch") === "true" // restore on refresh
    });
    const [isInstantUnits, setIsInstantUnits] = useState(() => {
        return localStorage.getItem("isInstantUnits") === "true" // restore on refresh
    });


    // Save to localStorage whenever it changes
    const toggleInstantBuild = (value) => {
        setIsInstantBuild(value);
        localStorage.setItem("isInstantBuild", value.toString());
    };
        const toggleisInstantResearch = (value) => {
        setIsInstantResearch(value);
        localStorage.setItem("isInstantResearch", value.toString());
    };
        const toggleisInstantUnits = (value) => {
        setIsInstantUnits(value);
        localStorage.setItem("isInstantUnits", value.toString());
    };
    
    useEffect(() => {
        if (!currentUser || !worldId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const worldDocRef = doc(db, 'worlds', worldId);
        const unsubscribeWorld = onSnapshot(worldDocRef, (docSnap) => {
            setWorldState(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
        });


        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const unsubscribeGameData = onSnapshot(gameDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPlayerGameData(data);
            } else {
                setPlayerGameData(null);
            }
        });

        const citiesColRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const unsubscribeCities = onSnapshot(citiesColRef, (snapshot) => {
            const citiesData = {};
            let firstCityId = null;
            snapshot.forEach(doc => {
                if (!firstCityId) firstCityId = doc.id;
                citiesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setPlayerCities(citiesData);
            const hasCities = !snapshot.empty;
            setPlayerHasCities(hasCities);

            setActiveCityId(currentId => {
                if (hasCities && (!currentId || !citiesData[currentId])) {
                    return firstCityId;
                }
                if (!hasCities) {
                    return null;
                }
                return currentId;
            });

            setLoading(false);
        });

        const conqueredVillagesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages');
        const unsubscribeVillages = onSnapshot(conqueredVillagesRef, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setConqueredVillages(villagesData);
        });

        const conqueredRuinsRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredRuins');
        const unsubscribeRuins = onSnapshot(conqueredRuinsRef, (snapshot) => {
            const ruinsData = {};
            snapshot.docs.forEach(doc => {
                ruinsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setConqueredRuins(ruinsData);
        });

        return () => {
            unsubscribeWorld();
            unsubscribeGameData();
            unsubscribeCities();
            unsubscribeVillages();
            unsubscribeRuins();
        };
    }, [currentUser, worldId]);

    // #comment This effect recalculates the player's total points and points per city whenever their cities change.
    useEffect(() => {
        if (!currentUser || !worldId || !playerCities) {
            if (!playerCities || Object.keys(playerCities).length === 0) {
                setPlayerCityPoints({}); // Clear points if no cities
            }
            return;
        }

        const recalculateAndSaveTotalPoints = async () => {
            let playerAlliance = null;
            if (playerGameData?.alliance) {
                const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerGameData.alliance);
                const allianceSnap = await getDoc(allianceDocRef);
                if (allianceSnap.exists()) {
                    playerAlliance = { id: allianceSnap.id, ...allianceSnap.data() };
                }
            }

            let totalPoints = 0;
            const newCityPoints = {};
            for (const cityId in playerCities) {
                const cityData = playerCities[cityId];
                const points = calculateTotalPointsForCity(cityData, playerAlliance);
                totalPoints += points;
                if (cityData.slotId) {
                    newCityPoints[cityData.slotId] = points;
                }
            }
            setPlayerCityPoints(newCityPoints);

            const cityCount = Object.keys(playerCities).length;

            if (playerGameData?.totalPoints !== totalPoints || playerGameData?.cityCount !== cityCount) {
                const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
                try {
                    const gameDocSnap = await getDoc(gameDocRef);
                    if (gameDocSnap.exists()) {
                        await updateDoc(gameDocRef, { totalPoints, cityCount });
                    }
                } catch (error) {
                    console.error("Error updating total points and city count:", error);
                }
            }
        };

        recalculateAndSaveTotalPoints();
    }, [playerCities, currentUser, worldId, playerGameData]);


    const activeCity = playerCities[activeCityId] || null;

    const gameState = activeCity;
    const playerCity = activeCity;



    const countCitiesOnIsland = useCallback((islandId) => {
        if (!islandId || !playerCities) return 0;
        return Object.values(playerCities).filter(city => city.islandId === islandId).length;
    }, [playerCities]);


    const renameCity = useCallback(async (cityId, newName) => {
        if (!currentUser || !worldId || !cityId || !newName.trim()) {
            throw new Error("Invalid parameters for renaming city.");
        }

        const cityToRename = playerCities[cityId];
        if (!cityToRename) {
            throw new Error("City not found.");
        }

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', cityId);
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', cityToRename.slotId);

        const batch = writeBatch(db);

        batch.update(cityDocRef, { cityName: newName.trim() });
        batch.update(citySlotRef, { cityName: newName.trim() });

        await batch.commit();


    }, [currentUser, worldId, playerCities]);

    const value = {
        worldId,
        worldState,
        playerGameData,
        playerCities,
        activeCityId,
        setActiveCityId,
        activeCity,
        playerHasCities,
        loading,
        conqueredVillages,
        conqueredRuins,
        gameSettings,
        setGameSettings,
        countCitiesOnIsland,
        renameCity,
        addNotification,
        playerCityPoints,
        gameState,
        playerCity,
        setGameState: (newState) => {
            if (activeCityId) {
                setPlayerCities(prev => ({...prev, [activeCityId]: newState}));
            }
        }
    };

    return <GameContext.Provider value={{...value, isInstantBuild, setIsInstantBuild: toggleInstantBuild, isInstantResearch, setIsInstantResearch: toggleisInstantResearch, isInstantUnits, setIsInstantUnits: toggleisInstantUnits }}>{children}</GameContext.Provider>;
};
