import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { db } from '../firebase/config';
import { collection, writeBatch, doc, serverTimestamp, getDoc, runTransaction, query, where, limit, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { calculateDistance, calculateTravelTime } from '../utils/travel';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

export const useMapActions = (openModal, closeModal, showCity, invalidateChunkCache, setMessage) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState, playerCity, setGameState, worldState, playerCities } = useGame();
    const [travelTimeInfo, setTravelTimeInfo] = useState(null);

    const handleActionClick = useCallback((mode, targetCity) => {
        if (['attack', 'reinforce', 'scout', 'trade'].includes(mode)) {
            openModal('action', { mode, city: targetCity });
            closeModal('city');
            closeModal('village');
        } else if (mode === 'withdraw') {
            openModal('withdraw', targetCity);
            closeModal('city');
        } else if (mode === 'message') {
            openModal('messages', { city: targetCity });
            closeModal('city');
        } else if (mode === 'castSpell') {
            openModal('divinePowers', { targetCity });
            closeModal('city');
        } else if (mode === 'profile') {
            openModal('profile', { userId: targetCity.ownerId });
            closeModal('city');
        } else if (['information', 'rally'].includes(mode)) {
            setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} is not yet implemented.`);
        }
    }, [openModal, closeModal, setMessage]);

    const handleSendMovement = useCallback(async (movementDetails) => {
        const { mode, targetCity, units, resources, attackFormation, hero } = movementDetails;
        if (!playerCity) {
            setMessage("Cannot send movement: Your city data could not be found.");
            return;
        }
        if (targetCity.isVillageTarget && playerCity.islandId !== targetCity.islandId) {
            setMessage("You can only attack villages from a city on the same island.");
            return;
        }

        const isCrossIsland = targetCity.isRuinTarget || targetCity.isGodTownTarget ? true : playerCity.islandId !== targetCity.islandId;
        let hasLandUnits = false, hasNavalUnits = false, hasFlyingUnits = false, totalTransportCapacity = 0, totalLandUnitsToSend = 0;

        for (const unitId in units) {
            if (units[unitId] > 0) {
                const config = unitConfig[unitId];
                if (config.type === 'land') {
                    hasLandUnits = true;
                    totalLandUnitsToSend += units[unitId];
                    if (config.flying) {
                        hasFlyingUnits = true;
                    }
                }
                else if (config.type === 'naval') { hasNavalUnits = true; totalTransportCapacity += (config.capacity || 0) * units[unitId]; }
            }
        }

        if (isCrossIsland && hasLandUnits && !hasNavalUnits && !hasFlyingUnits) { setMessage("Ground troops cannot travel across the sea without transport ships."); return; }
        if (isCrossIsland && hasLandUnits && totalTransportCapacity < totalLandUnitsToSend && !hasFlyingUnits) { setMessage(`Not enough transport ship capacity. Need ${totalLandUnitsToSend - totalTransportCapacity} more capacity.`); return; }

        const unitTypes = [];
        if (hasLandUnits) unitTypes.push('land');
        if (hasNavalUnits) unitTypes.push('naval');
        if (hasFlyingUnits) unitTypes.push('flying');

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const finalTargetOwnerId = targetCity.ownerId || currentUser.uid;
        const isOwnCityTarget = finalTargetOwnerId === currentUser.uid;
        let targetCityDocId = null;

        if (!targetCity.isVillageTarget && !targetCity.isRuinTarget && !targetCity.isGodTownTarget && finalTargetOwnerId) {
            if (isOwnCityTarget) {
                targetCityDocId = targetCity.id;
            } else {
                const citiesRef = collection(db, `users/${finalTargetOwnerId}/games`, worldId, 'cities');
                const q = query(citiesRef, where('slotId', '==', targetCity.id), limit(1));
                try {
                    const cityQuerySnap = await getDocs(q);
                    if (cityQuerySnap.empty) {
                        setMessage("Error: Could not find the target city's data. It may have been conquered or deleted.");
                        return;
                    }
                    targetCityDocId = cityQuerySnap.docs[0].id;
                } catch (error) {
                    console.error("Error fetching target city doc ID:", error);
                    setMessage("An error occurred while trying to target the city.");
                    return;
                }
            }
        }

        const distance = calculateDistance(playerCity, targetCity);
        const unitsBeingSent = Object.entries(units || {}).filter(([, count]) => count > 0);

        if (unitsBeingSent.length === 0 && !['trade', 'scout'].includes(mode) && !hero) {
            setMessage("No units or hero selected for movement.");
            return;
        }

        const slowestSpeed = unitsBeingSent.length > 0
            ? Math.min(...unitsBeingSent.map(([unitId]) => unitConfig[unitId].speed))
            : 10;
        const travelSeconds = calculateTravelTime(distance, slowestSpeed, mode, worldState, unitTypes);
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
        const cancellableUntil = new Date(Date.now() + 30 * 1000);

        let movementData;
        if (mode === 'attack' && targetCity.isGodTownTarget) {
            movementData = {
                type: 'attack_god_town',
                originCityId: playerCity.id,
                originCoords: { x: playerCity.x, y: playerCity.y },
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                targetTownId: targetCity.id,
                targetTownName: targetCity.name,
                targetCoords: { x: targetCity.x, y: targetCity.y },
                units: units,
                hero: hero,
                departureTime: serverTimestamp(),
                arrivalTime: arrivalTime,
                cancellableUntil: cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isGodTownTarget: true,
                isCrossIsland: true,
            };
        } else if (mode === 'attack' && targetCity.isVillageTarget) {
            movementData = {
                type: 'attack_village',
                originCityId: playerCity.id,
                originCoords: { x: playerCity.x, y: playerCity.y },
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                targetVillageId: targetCity.id,
                targetVillageName: targetCity.name,
                targetCoords: { x: targetCity.x, y: targetCity.y },
                units: units,
                hero: hero,
                resources: resources || {},
                departureTime: serverTimestamp(),
                arrivalTime: arrivalTime,
                cancellableUntil: cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isVillageTarget: true,
                isCrossIsland: false,
            };
        } else if (mode === 'attack' && targetCity.isRuinTarget) {
            movementData = {
                type: 'attack_ruin',
                originCityId: playerCity.id,
                originCoords: { x: playerCity.x, y: playerCity.y },
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                targetRuinId: targetCity.id,
                targetRuinName: targetCity.name,
                targetCoords: { x: targetCity.x, y: targetCity.y },
                units: units,
                hero: hero,
                departureTime: serverTimestamp(),
                arrivalTime: arrivalTime,
                cancellableUntil: cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isRuinTarget: true,
                isCrossIsland: true,
            };
        } else {
            movementData = {
                type: mode,
                originCityId: playerCity.id,
                originCoords: { x: playerCity.x, y: playerCity.y },
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                targetCityId: targetCityDocId,
                targetSlotId: isOwnCityTarget ? targetCity.slotId : targetCity.id,
                targetCoords: { x: targetCity.x, y: targetCity.y },
                targetOwnerId: finalTargetOwnerId,
                ownerUsername: targetCity.ownerUsername || userProfile.username,
                targetCityName: targetCity.cityName,
                units: units,
                hero: hero,
                resources: resources || {},
                departureTime: serverTimestamp(),
                arrivalTime: arrivalTime,
                cancellableUntil: cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: mode === 'scout' ? [currentUser.uid] : [currentUser.uid, finalTargetOwnerId].filter(id => id),
                isVillageTarget: !!targetCity.isVillageTarget,
                isCrossIsland,
            };
        }

        batch.set(newMovementRef, movementData);

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', playerCity.id);
        const updatedUnits = { ...gameState.units };
        for (const unitId in units) {
            updatedUnits[unitId] = (updatedUnits[unitId] || 0) - units[unitId];
        }

        const updatedResources = { ...gameState.resources };
        const updatedCave = { ...gameState.cave };
        if (mode === 'scout') {
            if (resources && resources.silver) {
                updatedCave.silver = (updatedCave.silver || 0) - resources.silver;
            }
        } else if (resources) {
            for (const resource in resources) {
                updatedResources[resource] -= resources[resource];
            }
        }

        const updatedHeroes = gameState.heroes ? { ...gameState.heroes } : {};
        if (hero && updatedHeroes[hero]) {
            updatedHeroes[hero].cityId = playerCity.id;
        }

        batch.update(gameDocRef, {
            units: updatedUnits,
            resources: updatedResources,
            cave: updatedCave,
            heroes: updatedHeroes
        });

        const newGameState = {
            ...gameState,
            units: updatedUnits,
            resources: updatedResources,
            cave: updatedCave,
            heroes: updatedHeroes
        };

        try {
            await batch.commit();
            setGameState(newGameState);
            setMessage(`Movement sent to ${targetCity.cityName || targetCity.name}!`);
        } catch (error) {
            console.error("Error sending movement:", error);
            setMessage(`Failed to send movement: ${error.message}`);
        }
    }, [currentUser, userProfile, worldId, gameState, playerCity, setGameState, setMessage, worldState]);

    const handleCancelMovement = useCallback(async (movementId) => {
        const movementRef = doc(db, 'worlds', worldId, 'movements', movementId);
        try {
            await runTransaction(db, async (transaction) => {
                const movementDoc = await transaction.get(movementRef);
                if (!movementDoc.exists()) {
                    throw new Error("Movement data not found.");
                }
                const movementData = movementDoc.data();
                const cancellableUntilData = movementData.cancellableUntil;
                const cancellableUntil = cancellableUntilData?.toDate ? cancellableUntilData.toDate() : new Date(cancellableUntilData);

                if (new Date() > cancellableUntil) {
                    throw new Error("The grace period to cancel this movement has passed.");
                }
                const now = Date.now();
                const departureTimeData = movementData.departureTime;
                const departureTime = departureTimeData?.toDate ? departureTimeData.toDate().getTime() : new Date(departureTimeData).getTime();
                const elapsedTime = now - departureTime;
                const returnArrivalTime = new Date(now + elapsedTime);

                transaction.update(movementRef, {
                    status: 'returning',
                    arrivalTime: returnArrivalTime,
                    departureTime: serverTimestamp(),
                    cancellableUntil: new Date(0)
                });
            });
            setMessage("Movement is now returning.");
        } catch (error) {
            console.error("Error cancelling movement:", error);
            setMessage(`Could not cancel movement: ${error.message}`);
        }
    }, [worldId, setMessage]);

    const handleCreateDummyCity = useCallback(async (citySlotId, slotData) => {
        if (!userProfile?.is_admin) {
            setMessage("You are not authorized to perform this action.");
            return;
        }
        setMessage("Creating dummy city...");
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
        const dummyUserId = `dummy_${uuidv4()}`;
        const dummyUsername = `DummyPlayer_${Math.floor(Math.random() * 10000)}`;
        const newCityDocRef = doc(collection(db, `users/${dummyUserId}/games`, worldId, 'cities'));

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("Slot is already taken.");
            }

            const batch = writeBatch(db);
            const dummyCityName = `${dummyUsername}'s Outpost`;
            batch.update(citySlotRef, {
                ownerId: dummyUserId,
                ownerUsername: dummyUsername,
                cityName: dummyCityName,
            });

            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(key => {
                initialBuildings[key] = { level: 0 };
            });
            initialBuildings.senate = { level: 1 };

            const newCityData = {
                id: newCityDocRef.id,
                slotId: citySlotId,
                cityName: dummyCityName,
                playerInfo: { religion: 'Dummy', nation: 'Dummy' },
                resources: { wood: 500, stone: 500, silver: 100 },
                buildings: initialBuildings,
                units: { swordsman: 10 },
                lastUpdated: Date.now(),
            };
            batch.set(newCityDocRef, newCityData);

            await batch.commit();
            setMessage(`Dummy city "${dummyCityName}" created successfully!`);
            invalidateChunkCache(slotData.x, slotData.y);
        } catch (error) {
            console.error("Error creating dummy city:", error);
            setMessage(`Failed to create dummy city: ${error.message}`);
        }
    }, [userProfile, worldId, invalidateChunkCache, setMessage]);

    // #comment Create a 'found_city' movement instead of instantly founding a city
    const handleFoundCity = useCallback(async (plot, agentId, units) => {
        if (!playerCity || !gameState) {
            setMessage("Cannot found city: Your city data could not be found.");
            return;
        }
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const batch = writeBatch(db);
        const baseFoundingTime = 86400;
        const reductionPerVillager = 3600;
        const villagers = units.villager || 0;
        const foundingTimeSeconds = Math.max(3600, baseFoundingTime - (villagers * reductionPerVillager));
        const arrivalTime = new Date(Date.now() + foundingTimeSeconds * 1000);
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
        const movementData = {
            type: 'found_city',
            originCityId: playerCity.id,
            originCoords: { x: playerCity.x, y: playerCity.y },
            originOwnerId: currentUser.uid,
            originCityName: playerCity.cityName,
            originOwnerUsername: userProfile.username,
            targetSlotId: plot.id,
            targetCoords: { x: plot.x, y: plot.y },
            targetPlotName: 'Empty Plot',
            units: units,
            agent: agentId,
            departureTime: serverTimestamp(),
            arrivalTime: arrivalTime,
            status: 'moving',
            involvedParties: [currentUser.uid],
            newCityName: finalCityName
        };
        batch.set(newMovementRef, movementData);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', playerCity.id);
        const updatedUnits = { ...gameState.units };
        for (const unitId in units) {
            updatedUnits[unitId] = (updatedUnits[unitId] || 0) - units[unitId];
        }
        const updatedAgents = { ...gameState.agents };
        updatedAgents[agentId] = (updatedAgents[agentId] || 0) - 1;
        batch.update(gameDocRef, {
            units: updatedUnits,
            agents: updatedAgents
        });
        const newGameState = {
            ...gameState,
            units: updatedUnits,
            agents: updatedAgents
        };
        try {
            await batch.commit();
            setGameState(newGameState);
            setMessage(`Your architect and troops are on their way to found a new city at (${plot.x}, ${plot.y})!`);
        } catch (error) {
            console.error("Error sending founding party:", error);
            setMessage(`Failed to send founding party: ${error.message}`);
        }
    }, [currentUser, userProfile, worldId, gameState, playerCity, setGameState, setMessage, playerCities]);

    const handleWithdrawTroops = useCallback(async (reinforcedCity, withdrawalData) => {
        if (!reinforcedCity || !reinforcedCity.ownerId) {
            setMessage("Invalid city data for withdrawal.");
            return;
        }
        const reinforcedCityOwnerId = reinforcedCity.ownerId;
        const reinforcedCitySlotId = reinforcedCity.slotId || reinforcedCity.id;
        const batch = writeBatch(db);
        for (const originCityId in withdrawalData) {
            const unitsToWithdraw = withdrawalData[originCityId];
            if (Object.values(unitsToWithdraw).every(amount => amount === 0)) {
                continue;
            }
            const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
            const originCity = playerCities[originCityId];
            if (!originCity) {
                console.error(`Could not find origin city with ID ${originCityId} for withdrawal.`);
                continue;
            }
            const distance = calculateDistance(reinforcedCity, originCity);
            const speeds = Object.keys(unitsToWithdraw).map(unitId => unitConfig[unitId].speed);
            const slowestSpeed = Math.min(...speeds);
            const travelSeconds = calculateTravelTime(distance, slowestSpeed);
            const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
            const movementData = {
                type: 'return',
                status: 'returning',
                originCityId: originCityId,
                originCoords: { x: originCity.x, y: originCity.y },
                originOwnerId: currentUser.uid,
                originCityName: originCity.cityName,
                targetCityId: reinforcedCity.id,
                targetCoords: { x: reinforcedCity.x, y: reinforcedCity.y },
                units: unitsToWithdraw,
                departureTime: serverTimestamp(),
                arrivalTime: arrivalTime,
                involvedParties: [currentUser.uid, reinforcedCityOwnerId]
            };
            batch.set(newMovementRef, movementData);
        }
        try {
            await runTransaction(db, async (transaction) => {
                const citiesRef = collection(db, `users/${reinforcedCityOwnerId}/games`, worldId, 'cities');
                const q = query(citiesRef, where('slotId', '==', reinforcedCitySlotId), limit(1));
                const cityQuerySnap = await getDocs(q);
                if (cityQuerySnap.empty) {
                    console.warn(`Could not find city doc for slotId ${reinforcedCitySlotId} to update reinforcements.`);
                    return;
                }
                const reinforcedCityDocId = cityQuerySnap.docs[0].id;
                const reinforcedCityRef = doc(db, `users/${reinforcedCityOwnerId}/games`, worldId, 'cities', reinforcedCityDocId);
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', reinforcedCitySlotId);
                const reinforcedCitySnap = await transaction.get(reinforcedCityRef);
                if (!reinforcedCitySnap.exists()) {
                    throw new Error("Reinforced city data not found.");
                }
                const currentReinforcements = reinforcedCitySnap.data().reinforcements || {};
                const newReinforcements = JSON.parse(JSON.stringify(currentReinforcements));
                for (const originCityId in withdrawalData) {
                    const unitsToWithdraw = withdrawalData[originCityId];
                    for (const unitId in unitsToWithdraw) {
                        if (newReinforcements[originCityId]?.units?.[unitId]) {
                            newReinforcements[originCityId].units[unitId] -= unitsToWithdraw[unitId];
                            if (newReinforcements[originCityId].units[unitId] <= 0) {
                                delete newReinforcements[originCityId].units[unitId];
                            }
                        }
                    }
                    if (Object.keys(newReinforcements[originCityId]?.units || {}).length === 0) {
                        delete newReinforcements[originCityId];
                    }
                }
                transaction.update(reinforcedCityRef, { reinforcements: newReinforcements });
                transaction.update(citySlotRef, { reinforcements: newReinforcements });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error withdrawing troops:", error);
            setMessage(`Failed to withdraw troops: ${error.message}`);
        }
    }, [currentUser, worldId, playerCities, setMessage]);

    return {
        travelTimeInfo,
        setTravelTimeInfo,
        handleActionClick,
        handleSendMovement,
        handleCancelMovement,
        handleCreateDummyCity,
        handleWithdrawTroops,
        handleFoundCity,
    };
};
