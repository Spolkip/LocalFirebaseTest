// src/hooks/useMovementProcessor.js
import { useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, runTransaction, arrayUnion, deleteDoc, updateDoc } from 'firebase/firestore';
import { resolveCombat, resolveScouting, getVillageTroops } from '../utils/combat';
import { useCityState } from './useCityState';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';
import { v4 as uuidv4 } from 'uuid';

const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useMovementProcessor = (worldId) => {
    const { getHospitalCapacity } = useCityState(worldId);

    const processMovement = useCallback(async (movementDoc) => {
        console.log(`Processing movement ID: ${movementDoc.id}`);
        const movement = { id: movementDoc.id, ...movementDoc.data() };

        // #comment Handle hero assignment first as it has no origin city
        if (movement.type === 'assign_hero') {
            const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
            try {
                await runTransaction(db, async (transaction) => {
                    const cityDoc = await transaction.get(targetCityRef);
                    if (!cityDoc.exists()) throw new Error("Target city not found.");
    
                    const cityData = cityDoc.data();
                    const heroes = cityData.heroes || {};
                    const newHeroes = { ...heroes, [movement.hero]: { ...heroes[movement.hero], cityId: movement.targetCityId } };
    
                    transaction.update(targetCityRef, { heroes: newHeroes });
                    transaction.delete(movementDoc.ref);
                });
            } catch (error) {
                console.error("Error processing hero assignment:", error);
                await deleteDoc(movementDoc.ref);
            }
            return; // End processing for this movement
        }
        
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);

        let targetCityRef;
        if (movement.targetOwnerId && movement.targetCityId) {
            targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        }

        // #comment Handle city founding movements
        if (movement.type === 'found_city') {
            const targetSlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);

            if (movement.status === 'moving') {
                // Troops have arrived, now start the founding timer.
                const newArrivalTime = new Date(Date.now() + movement.foundingTimeSeconds * 1000);
                await updateDoc(movementDoc.ref, {
                    status: 'founding',
                    arrivalTime: newArrivalTime,
                });
                return; // Stop processing, wait for founding to finish
            }

            if (movement.status === 'founding') {
                const newCityDocRef = doc(collection(db, `users/${movement.originOwnerId}/games`, worldId, 'cities'));
                try {
                    await runTransaction(db, async (transaction) => {
                        const [targetSlotSnap, originCitySnap] = await Promise.all([
                            transaction.get(targetSlotRef),
                            transaction.get(originCityRef)
                        ]);
                        if (!originCitySnap.exists()) {
                            transaction.delete(movementDoc.ref);
                            return;
                        }
                        if (!targetSlotSnap.exists() || targetSlotSnap.data().ownerId !== null) {
                            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                            transaction.update(movementDoc.ref, {
                                status: 'returning',
                                units: movement.units,
                                agent: movement.agent,
                                arrivalTime: returnArrivalTime,
                                involvedParties: [movement.originOwnerId]
                            });
                            const failureReport = {
                                type: 'found_city_failed',
                                title: `Founding attempt failed`,
                                timestamp: serverTimestamp(),
                                outcome: { message: `The plot at (${movement.targetCoords.x}, ${movement.targetCoords.y}) was claimed by another player before your party arrived.` },
                                read: false,
                            };
                            transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failureReport);
                            return;
                        }
                        const originCityData = originCitySnap.data();
                        const newCityName = movement.newCityName;
                        transaction.update(targetSlotRef, {
                            ownerId: movement.originOwnerId,
                            ownerUsername: movement.originOwnerUsername,
                            cityName: newCityName,
                            alliance: originCityData.alliance || null,
                            allianceName: originCityData.allianceName || null,
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
                            slotId: movement.targetSlotId,
                            x: movement.targetCoords.x,
                            y: movement.targetCoords.y,
                            islandId: targetSlotSnap.data().islandId,
                            cityName: newCityName,
                            playerInfo: originCityData.playerInfo,
                            resources: { wood: 1000, stone: 1000, silver: 500 },
                            buildings: initialBuildings,
                            units: movement.units, wounded: {}, research: {}, worship: {},
                            cave: { silver: 0 }, buildQueue: [], barracksQueue: [],
                            shipyardQueue: [], divineTempleQueue: [], healQueue: [],
                            lastUpdated: serverTimestamp(),
                        };
                        transaction.set(newCityDocRef, newCityData);
                        const successReport = {
                            type: 'found_city_success',
                            title: `New city founded!`,
                            timestamp: serverTimestamp(),
                            outcome: { message: `You have successfully founded the city of ${newCityName} at (${movement.targetCoords.x}, ${movement.targetCoords.y}). Your troops have garrisoned the new city.` },
                            read: false,
                        };
                        transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), successReport);
                        transaction.delete(movementDoc.ref);
                    });
                } catch (error) {
                    console.error("Error in found_city transaction:", error);
                    await deleteDoc(movementDoc.ref);
                }
                return;
            }
        }


        const batch = writeBatch(db);
        const [originCitySnap, targetCitySnap] = await Promise.all([
            getDoc(originCityRef),
            targetCityRef ? getDoc(targetCityRef) : Promise.resolve(null)
        ]);

        const originGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
        const targetGameRef = movement.targetOwnerId ? doc(db, `users/${movement.targetOwnerId}/games`, worldId) : null;

        const [originGameSnap, targetGameSnap] = await Promise.all([
            getDoc(originGameRef),
            targetGameRef ? getDoc(targetGameRef) : Promise.resolve(null)
        ]);

        const originGameData = originGameSnap.exists() ? originGameSnap.data() : {};
        const targetGameData = targetGameSnap?.exists() ? targetGameSnap.data() : {};

        const originAlliancePromise = originGameData.alliance ? getDoc(doc(db, 'worlds', worldId, 'alliances', originGameData.alliance)) : Promise.resolve(null);
        const targetAlliancePromise = targetGameData.alliance ? getDoc(doc(db, 'worlds', worldId, 'alliances', targetGameData.alliance)) : Promise.resolve(null);
        const [originAllianceSnap, targetAllianceSnap] = await Promise.all([originAlliancePromise, targetAlliancePromise]);
        const originAllianceData = originAllianceSnap?.exists() ? {id: originAllianceSnap.id, name: originAllianceSnap.data().name} : null;
        const targetAllianceData = targetAllianceSnap?.exists() ? {id: targetAllianceSnap.id, name: targetAllianceSnap.data().name} : null;

        if (!originCitySnap.exists()) {
            console.log(`Origin city ${movement.originOwnerId} for owner ${movement.originOwnerId} not found. Deleting movement.`);
            batch.delete(movementDoc.ref);
            await batch.commit();
            return;
        }

        const originCityState = originCitySnap.data();

        if (movement.status === 'returning') {
            console.log(`Movement ${movement.id} is returning.`);
            const newCityState = { ...originCityState };
            const newUnits = { ...newCityState.units };
            for (const unitId in movement.units) {
                newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
            }
            // #comment Return agent if it exists in the movement
            if (movement.agent) {
                const newAgents = { ...(newCityState.agents || {}) };
                newAgents[movement.agent] = (newAgents[movement.agent] || 0) + 1;
                batch.update(originCityRef, { agents: newAgents });
            }

            // #comment When a hero returns, update their status across ALL of the owner's cities.
            if (movement.hero) {
                const heroOwnerCitiesRef = collection(db, `users/${movement.originOwnerId}/games`, worldId, 'cities');
                const heroOwnerCitiesSnap = await getDocs(heroOwnerCitiesRef);

                heroOwnerCitiesSnap.forEach(cityDoc => {
                    const cityData = cityDoc.data();
                    const heroes = cityData.heroes || {};
                    if (heroes[movement.hero]) {
                        const heroState = heroes[movement.hero];
                        
                        // #comment Create a new hero object, preserving existing properties like woundedUntil
                        const updatedHeroState = {
                            ...heroState,
                            cityId: movement.originCityId, // Set the new cityId
                        };
                        
                        // #comment Explicitly remove the capturedIn field
                        delete updatedHeroState.capturedIn;

                        // #comment Create the new top-level heroes object
                        const newHeroes = {
                            ...heroes,
                            [movement.hero]: updatedHeroState,
                        };

                        batch.update(cityDoc.ref, { heroes: newHeroes });
                    }
                });
            }

            const capacity = getWarehouseCapacity(newCityState.buildings.warehouse?.level);
            const newResources = { ...newCityState.resources };

            if (movement.resources) {
                for (const resourceId in movement.resources) {
                    newResources[resourceId] = (newResources[resourceId] || 0) + movement.resources[resourceId];
                }
            }
            newResources.wood = Math.min(capacity, newResources.wood || 0);
            newResources.stone = Math.min(capacity, newResources.stone || 0);
            newResources.silver = Math.min(capacity, newResources.silver || 0);

            const newWounded = { ...newCityState.wounded };
            let totalWoundedInHospital = Object.values(newWounded).reduce((sum, count) => sum + count, 0);
            const hospitalCapacity = getHospitalCapacity(newCityState.buildings.hospital?.level || 0);

            if (movement.wounded) {
                for (const unitId in movement.wounded) {
                    const woundedCount = movement.wounded[unitId];
                    if (totalWoundedInHospital < hospitalCapacity) {
                        const canFit = hospitalCapacity - totalWoundedInHospital;
                        const toHeal = Math.min(canFit, woundedCount);
                        newWounded[unitId] = (newWounded[unitId] || 0) + toHeal;
                        totalWoundedInHospital += toHeal;
                    }
                }
            }

             const returnReport = {
                type: 'return',
                title: `Troops returned to ${originCityState.cityName}`,
                timestamp: serverTimestamp(),
                units: movement.units || {},
                hero: movement.hero || null,
                resources: movement.resources || {},
                wounded: movement.wounded || {},
                read: false,
            };

            batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), returnReport);
            batch.update(originCityRef, { units: newUnits, resources: newResources, wounded: newWounded });
            batch.delete(movementDoc.ref);
            await batch.commit();
            console.log(`Movement ${movement.id} processed and deleted.`);
        } else if (movement.status === 'moving') {
            console.log(`Movement ${movement.id} is moving with type: ${movement.type}`);
            const targetCityState = targetCitySnap?.exists() ? targetCitySnap.data() : null;
            switch (movement.type) {
                case 'attack_god_town': {
                    console.log(`Processing God Town attack: ${movement.id}`);
                    const townRef = doc(db, 'worlds', worldId, 'godTowns', movement.targetTownId);
                    const townSnap = await getDoc(townRef);
                    if (!townSnap.exists() || townSnap.data().stage !== 'city') {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        });
                        break;
                    }
                    const townData = townSnap.data();
                    const combatResult = resolveCombat(movement.units, townData.troops, {}, false);
                    const damageDealt = Object.values(combatResult.defenderLosses).reduce((sum, count) => sum + count, 0) * 5;
                    const newHealth = Math.max(0, (townData.health || 10000) - damageDealt);
                    const warPoints = Math.floor(damageDealt / 10);
                    const resourcesWon = {
                        wood: warPoints * 10,
                        stone: warPoints * 10,
                        silver: warPoints * 5
                    };
                    const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', movement.targetTownId, 'playerProgress', movement.originOwnerId);
                    const playerProgressSnap = await getDoc(playerProgressRef);
                    const currentDamage = playerProgressSnap.exists() ? playerProgressSnap.data().damageDealt : 0;
                    batch.set(playerProgressRef, { damageDealt: currentDamage + damageDealt }, { merge: true });
                    const attackerReport = {
                        type: 'attack_god_town',
                        title: `Attack on ${townData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: combatResult,
                        rewards: { warPoints, resources: resourcesWon },
                        read: false,
                    };
                    if (newHealth === 0) {
                        batch.delete(townRef);
                        attackerReport.rewards.message = "You have vanquished the City of the Gods! It has vanished from the world.";
                    } else {
                        const newTroops = { ...townData.troops };
                        for (const unitId in combatResult.defenderLosses) {
                            newTroops[unitId] = Math.max(0, (newTroops[unitId] || 0) - combatResult.defenderLosses[unitId]);
                        }
                        batch.update(townRef, { health: newHealth, troops: newTroops });
                    }
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                    const survivingAttackers = {};
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (combatResult.attackerLosses[unitId] || 0);
                        if (survivors > 0) survivingAttackers[unitId] = survivors;
                    }
                    const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                    const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                    batch.update(movementDoc.ref, {
                        status: 'returning',
                        units: survivingAttackers,
                        resources: resourcesWon,
                        arrivalTime: returnArrivalTime,
                        involvedParties: [movement.originOwnerId]
                    });
                    await batch.commit();
                    break;
                }
                case 'attack_village': {
                    console.log(`Processing village attack: ${movement.id}`);
                    const villageRef = doc(db, 'worlds', worldId, 'villages', movement.targetVillageId);
                    const villageSnap = await getDoc(villageRef);
                    if (!villageSnap.exists()) {
                        console.log(`Village ${movement.targetVillageId} not found.`);
                        batch.delete(movementDoc.ref);
                        const report = {
                            type: 'attack_village',
                            title: `Attack on missing village`,
                            timestamp: serverTimestamp(),
                            outcome: { message: 'The village was no longer there.' },
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), report);
                        break;
                    }
                    const villageData = villageSnap.data();
                    const villageTroops = getVillageTroops(villageData);
                    const result = resolveCombat(movement.units, villageTroops, villageData.resources, false);
                    console.log('Village combat resolved:', result);
                    if (result.attackerWon) {
                        console.log('Attacker won. Conquering/farming village.');
                        const playerVillageRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredVillages`, movement.targetVillageId);
                        batch.set(playerVillageRef, {
                            level: villageData.level,
                            lastCollected: serverTimestamp(),
                            happiness: 100,
                            happinessLastUpdated: serverTimestamp()
                        }, { merge: true });
                    }
                    const reportOutcome = { ...result };
                    delete reportOutcome.attackerBattlePoints;
                    delete reportOutcome.defenderBattlePoints;
                    const attackerReport = {
                        type: 'attack_village',
                        title: `Attack on ${villageData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: reportOutcome,
                        attacker: {
                            cityId: movement.originCityId,
                            cityName: originCityState.cityName,
                            units: movement.units,
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            allianceId: originAllianceData ? originAllianceData.id : null,
                            allianceName: originAllianceData ? originAllianceData.name : null,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: {
                            villageId: movement.targetVillageId,
                            villageName: villageData.name,
                            troops: villageTroops,
                            losses: result.defenderLosses,
                            x: villageData.x,
                            y: villageData.y
                        },
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }
                    if (anySurvivors || Object.keys(result.wounded).length > 0) {
                        console.log('Survivors/wounded are returning.');
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        });
                    } else {
                        console.log('No survivors. Deleting movement.');
                        batch.delete(movementDoc.ref);
                    }
                    await batch.commit();
                    break;
                }
                case 'attack_ruin': {
                    console.log(`Processing ruin attack: ${movement.id}`);
                    const ruinRef = doc(db, 'worlds', worldId, 'ruins', movement.targetRuinId);
                    const ruinSnap = await getDoc(ruinRef);
                    if (!ruinSnap.exists()) {
                        console.log(`Ruin ${movement.targetRuinId} not found.`);
                        batch.delete(movementDoc.ref);
                        const report = {
                            type: 'attack_ruin',
                            title: `Attack on vanished ruins`,
                            timestamp: serverTimestamp(),
                            outcome: { message: 'The ruins crumbled into the sea before your fleet arrived.' },
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), report);
                        break;
                    }
                    const ruinData = ruinSnap.data();
                    if (ruinData.ownerId) {
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const result = resolveCombat(movement.units, ruinData.troops, {}, true);
                    if (result.attackerBattlePoints > 0) {
                        const attackerGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
                        const attackerGameDoc = await getDoc(attackerGameRef);
                        if (attackerGameDoc.exists()) {
                            const currentPoints = attackerGameDoc.data().battlePoints || 0;
                            batch.update(attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
                        }
                    }
                    if (result.attackerWon) {
                        const newCityState = { ...originCityState };
                        if (!newCityState.research) newCityState.research = {};
                        newCityState.research[ruinData.researchReward] = true;
                        batch.update(originCityRef, { research: newCityState.research });
                        batch.update(ruinRef, {
                            ownerId: movement.originOwnerId,
                            ownerUsername: movement.originOwnerUsername
                        });
                        const playerRuinRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredRuins`, movement.targetRuinId);
                        batch.set(playerRuinRef, {
                            conqueredAt: serverTimestamp(),
                            researchReward: ruinData.researchReward
                        });
                    } else {
                        const survivingRuinTroops = { ...ruinData.troops };
                        for (const unitId in result.defenderLosses) {
                            survivingRuinTroops[unitId] = Math.max(0, (survivingRuinTroops[unitId] || 0) - result.defenderLosses[unitId]);
                        }
                        batch.update(ruinRef, { troops: survivingRuinTroops });
                    }
                    const attackerReport = {
                        type: 'attack_ruin',
                        title: `Attack on ${ruinData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: {
                            cityId: movement.originCityId,
                            cityName: originCityState.cityName,
                            units: movement.units,
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            allianceId: originAllianceData ? originAllianceData.id : null,
                            allianceName: originAllianceData ? originAllianceData.name : null,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: {
                            ruinId: movement.targetRuinId,
                            ruinName: ruinData.name,
                            troops: ruinData.troops,
                            losses: result.defenderLosses,
                            x: ruinData.x,
                            y: ruinData.y
                        },
                        reward: result.attackerWon ? ruinData.researchReward : null,
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }
                    if (anySurvivors || Object.keys(result.wounded).length > 0) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    await batch.commit();
                    break;
                }
                case 'attack': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    // #comment Combine defender's own units and reinforcements for combat
                    const allDefendingUnits = { ...(targetCityState.units || {}) };
                    if (targetCityState.reinforcements) {
                        for (const originCityId in targetCityState.reinforcements) {
                            const reinf = targetCityState.reinforcements[originCityId];
                            for (const unitId in reinf.units) {
                                allDefendingUnits[unitId] = (allDefendingUnits[unitId] || 0) + reinf.units[unitId];
                            }
                        }
                    }

                    const result = resolveCombat(
                        movement.units,
                        allDefendingUnits,
                        targetCityState.resources,
                        !!movement.isCrossIsland,
                        movement.attackFormation?.front,
                        movement.attackFormation?.mid,
                        null,
                        null,
                        movement.hero,
                        Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null
                    );
                    
                    // #comment This transaction only handles battle points to avoid contention with other updates.
                    await runTransaction(db, async (transaction) => {
                        const attackerGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
                        const defenderGameRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId);
                        const attackerGameDoc = await transaction.get(attackerGameRef);
                        const defenderGameDoc = await transaction.get(defenderGameRef);
                        if (attackerGameDoc.exists() && result.attackerBattlePoints > 0) {
                            const currentPoints = attackerGameDoc.data().battlePoints || 0;
                            transaction.update(attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
                        }
                        if (defenderGameDoc.exists() && result.defenderBattlePoints > 0) {
                            const currentPoints = defenderGameDoc.data().battlePoints || 0;
                            transaction.update(defenderGameRef, { battlePoints: currentPoints + result.defenderBattlePoints });
                        }
                    });

                    // #comment Helper to update a hero's state across all their owner's cities.
                    const updateGlobalHeroState = async (heroId, ownerId, updates) => {
                        const ownerCitiesRef = collection(db, `users/${ownerId}/games`, worldId, 'cities');
                        const ownerCitiesSnap = await getDocs(ownerCitiesRef);
                        ownerCitiesSnap.forEach(cityDoc => {
                            const cityRef = cityDoc.ref;
                            const heroUpdateData = {};
                            for (const key in updates) {
                                heroUpdateData[`heroes.${heroId}.${key}`] = updates[key];
                            }
                            batch.update(cityRef, heroUpdateData);
                        });
                    };

                    if (result.woundedHero) {
                        const { heroId, side } = result.woundedHero;
                        const woundedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
                        const heroOwnerId = side === 'attacker' ? movement.originOwnerId : movement.targetOwnerId;
                        await updateGlobalHeroState(heroId, heroOwnerId, { woundedUntil: woundedUntil, cityId: null });
                    }

                    if (result.capturedHero) {
                        const { heroId, capturedBy } = result.capturedHero;
                        const prisonerObject = {
                            captureId: uuidv4(),
                            heroId,
                        };
                        let wasImprisoned = false;
                        if (capturedBy === 'attacker') {
                            prisonerObject.ownerId = movement.targetOwnerId;
                            prisonerObject.ownerUsername = movement.ownerUsername;
                            prisonerObject.originCityId = movement.targetCityId;
                            prisonerObject.originCityName = movement.targetCityName;
                            prisonerObject.originCityCoords = { x: targetCityState.x, y: targetCityState.y };
                            const prisonLevel = originCityState.buildings.prison?.level || 0;
                            const capacity = prisonLevel > 0 ? prisonLevel + 4 : 0;
                            const currentPrisoners = originCityState.prisoners?.length || 0;
                            if (prisonLevel > 0 && currentPrisoners < capacity) {
                                const newPrisonerObject = { ...prisonerObject, capturedAt: new Date() };
                                batch.update(originCityRef, { prisoners: arrayUnion(newPrisonerObject) });
                                wasImprisoned = true;
                            }
                        } else { // captured by defender
                            prisonerObject.ownerId = movement.originOwnerId;
                            prisonerObject.ownerUsername = movement.originOwnerUsername;
                            prisonerObject.originCityId = movement.originCityId;
                            prisonerObject.originCityName = movement.originCityName;
                            prisonerObject.originCityCoords = { x: originCityState.x, y: originCityState.y };
                            const prisonLevel = targetCityState.buildings.prison?.level || 0;
                            const capacity = prisonLevel > 0 ? prisonLevel + 4 : 0;
                            const currentPrisoners = targetCityState.prisoners?.length || 0;
                            if (prisonLevel > 0 && currentPrisoners < capacity) {
                                const newPrisonerObject = { ...prisonerObject, capturedAt: new Date() };
                                batch.update(targetCityRef, { prisoners: arrayUnion(newPrisonerObject) });
                                wasImprisoned = true;
                            }
                        }
                        if (!wasImprisoned) {
                            result.capturedHero = null;
                        } else {
                            const heroOwnerId = capturedBy === 'attacker' ? movement.targetOwnerId : movement.originOwnerId;
                            const capturingCityId = capturedBy === 'attacker' ? movement.originCityId : movement.targetCityId;
                            await updateGlobalHeroState(heroId, heroOwnerId, { capturedIn: capturingCityId, cityId: null });
                        }
                    }
                    
                    // #comment Distribute losses proportionally
                    const newDefenderUnits = { ...(targetCityState.units || {}) };
                    const newReinforcements = JSON.parse(JSON.stringify(targetCityState.reinforcements || {}));
                    const reinforcementLossesReport = {};

                    for (const unitId in result.defenderLosses) {
                        const totalLosses = result.defenderLosses[unitId];
                        const totalPresent = allDefendingUnits[unitId];
                        if (totalPresent <= 0) continue;
                
                        // Apply losses to city owner
                        const ownerCount = newDefenderUnits[unitId] || 0;
                        if (ownerCount > 0) {
                            const ownerLosses = Math.round((ownerCount / totalPresent) * totalLosses);
                            newDefenderUnits[unitId] = Math.max(0, ownerCount - ownerLosses);
                        }
                
                        // Apply losses to reinforcements
                        for (const originCityId in newReinforcements) {
                            const reinf = newReinforcements[originCityId];
                            const reinfCount = reinf.units?.[unitId] || 0;
                            if (reinfCount > 0) {
                                const reinfLosses = Math.round((reinfCount / totalPresent) * totalLosses);
                                const actualLosses = Math.min(reinfCount, reinfLosses);
                                reinf.units[unitId] -= actualLosses;
                                
                                // Prepare report for reinforcing player
                                if (actualLosses > 0) {
                                    if (!reinforcementLossesReport[reinf.ownerId]) {
                                        reinforcementLossesReport[reinf.ownerId] = { losses: {} };
                                    }
                                    reinforcementLossesReport[reinf.ownerId].losses[unitId] = (reinforcementLossesReport[reinf.ownerId].losses[unitId] || 0) + actualLosses;
                                }
                            }
                        }
                    }

                    // #comment Clean up zero-count units and empty reinforcement objects
                    Object.keys(newDefenderUnits).forEach(id => { if (newDefenderUnits[id] <= 0) delete newDefenderUnits[id]; });
                    for (const originCityId in newReinforcements) {
                        Object.keys(newReinforcements[originCityId].units).forEach(id => {
                            if (newReinforcements[originCityId].units[id] <= 0) delete newReinforcements[originCityId].units[id];
                        });
                        if (Object.keys(newReinforcements[originCityId].units).length === 0) delete newReinforcements[originCityId];
                    }
                    
                    const newDefenderResources = { ...targetCityState.resources };
                    if (result.attackerWon) {
                        newDefenderResources.wood = Math.max(0, newDefenderResources.wood - result.plunder.wood);
                        newDefenderResources.stone = Math.max(0, newDefenderResources.stone - result.plunder.stone);
                        newDefenderResources.silver = Math.max(0, newDefenderResources.silver - result.plunder.silver);
                    }
                    const survivingAttackers = {};
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                        }
                    }
                    const hasSurvivingLandOrMythic = Object.keys(survivingAttackers).some(unitId => {
                        const unit = unitConfig[unitId];
                        return unit && (unit.type === 'land' || unit.mythical);
                    });
                    const attackerReport = {
                        type: 'attack',
                        title: `Attack on ${targetCityState.cityName}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: {
                            cityId: movement.originCityId,
                            cityName: originCityState.cityName,
                            units: movement.units,
                            hero: movement.hero || null,
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            allianceId: originAllianceData ? originAllianceData.id : null,
                            allianceName: originAllianceData ? originAllianceData.name : null,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: {
                            cityId: movement.targetCityId,
                            cityName: targetCityState.cityName,
                            units: hasSurvivingLandOrMythic ? targetCityState.units : {},
                            hero: hasSurvivingLandOrMythic ? (Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null) : null,
                            losses: hasSurvivingLandOrMythic ? result.defenderLosses : {},
                            ownerId: movement.targetOwnerId,
                            username: movement.ownerUsername || 'Unknown Player',
                            allianceId: targetAllianceData ? targetAllianceData.id : null,
                            allianceName: targetAllianceData ? targetAllianceData.name : null,
                            x: targetCityState.x,
                            y: targetCityState.y
                        },
                        read: false,
                    };
                    if (!hasSurvivingLandOrMythic) {
                        attackerReport.outcome.message = "Your forces were annihilated. No information could be gathered from the battle.";
                    }
                    const defenderReport = {
                        type: 'attack',
                        title: `Defense of ${targetCityState.cityName}`,
                        timestamp: serverTimestamp(),
                        outcome: {
                            attackerWon: !result.attackerWon,
                            plunder: {},
                            attackerLosses: result.attackerLosses,
                            defenderLosses: result.defenderLosses,
                            wounded: {},
                            attackerBattlePoints: result.attackerBattlePoints,
                            defenderBattlePoints: result.defenderBattlePoints,
                            capturedHero: result.capturedHero,
                            woundedHero: result.woundedHero,
                        },
                        attacker: {
                            cityId: movement.originCityId,
                            cityName: originCityState.cityName,
                            units: movement.units,
                            hero: movement.hero || null,
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            allianceId: originAllianceData ? originAllianceData.id : null,
                            allianceName: originAllianceData ? originAllianceData.name : null,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: {
                            cityId: movement.targetCityId,
                            cityName: targetCityState.cityName,
                            units: targetCityState.units,
                            hero: Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null,
                            losses: result.defenderLosses,
                            ownerId: movement.targetOwnerId,
                            username: movement.ownerUsername || 'Unknown Player',
                            allianceId: targetAllianceData ? targetAllianceData.id : null,
                            allianceName: targetAllianceData ? targetAllianceData.name : null,
                            x: targetCityState.x,
                            y: targetCityState.y
                        },
                        read: false,
                    };
                    batch.update(targetCityRef, { units: newDefenderUnits, resources: newDefenderResources, reinforcements: newReinforcements });
                    const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
                    batch.update(targetCitySlotRef, { reinforcements: newReinforcements });
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                    if (movement.targetOwnerId) {
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), defenderReport);
                    }
                    const heroSurvives = movement.hero && (!result.capturedHero || result.capturedHero.heroId !== movement.hero);
                    if (Object.keys(survivingAttackers).length > 0 || Object.keys(result.wounded).length > 0 || heroSurvives) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        const returningMovementData = {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        };
                        if (heroSurvives) {
                            returningMovementData.hero = movement.hero;
                        }
                        batch.update(movementDoc.ref, returningMovementData);
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    await batch.commit();
                    break;
                }
                case 'scout': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const attackingSilver = movement.resources?.silver || 0;
                    const result = resolveScouting(targetCityState, attackingSilver);
                    if (result.success) {
                        const scoutReport = {
                            type: 'scout',
                            title: `Scout report of ${targetCityState.cityName}`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: true,
                            ...result,
                            targetOwnerUsername: movement.ownerUsername,
                            attacker: {
                                cityId: movement.originCityId,
                                cityName: originCityState.cityName,
                                ownerId: movement.originOwnerId,
                                username: movement.originOwnerUsername,
                                allianceId: originAllianceData ? originAllianceData.id : null,
                                allianceName: originAllianceData ? originAllianceData.name : null,
                                x: originCityState.x,
                                y: originCityState.y
                            },
                            defender: {
                                cityId: movement.targetCityId,
                                cityName: targetCityState.cityName,
                                ownerId: movement.targetOwnerId,
                                username: movement.ownerUsername,
                                allianceId: targetAllianceData ? targetAllianceData.id : null,
                                allianceName: targetAllianceData ? targetAllianceData.name : null,
                                x: targetCityState.x,
                                y: targetCityState.y
                            },
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), scoutReport);
                    } else {
                        const failedScoutAttackerReport = {
                            type: 'scout',
                            title: `Scouting ${targetCityState.cityName} failed`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: false,
                            message: result.message,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failedScoutAttackerReport);
                        const newDefenderCave = { ...targetCityState.cave, silver: (targetCityState.cave?.silver || 0) + result.silverGained };
                        batch.update(targetCityRef, { cave: newDefenderCave });
                        const spyCaughtReport = {
                            type: 'spy_caught',
                            title: `Caught a spy from ${originCityState.cityName}!`,
                            timestamp: serverTimestamp(),
                            originCity: originCityState.cityName,
                            silverGained: result.silverGained,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), spyCaughtReport);
                    }
                    batch.delete(movementDoc.ref);
                    await batch.commit();
                    break;
                }
                case 'reinforce': {
                    if (!targetCityState || !movement.targetSlotId) {
                        console.log(`Target game state or slot ID not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
                    await runTransaction(db, async (transaction) => {
                        const targetCitySnap = await transaction.get(targetCityRef);
                        const targetCitySlotSnap = await transaction.get(targetCitySlotRef);
                        if (!targetCitySnap.exists() || !targetCitySlotSnap.exists()) {
                            throw new Error("Target city or slot data not found.");
                        }
                        const currentCityState = targetCitySnap.data();
                        const newReinforcements = { ...(currentCityState.reinforcements || {}) };
                        const originCityId = movement.originCityId;
                        if (!newReinforcements[originCityId]) {
                            newReinforcements[originCityId] = {
                                ownerId: movement.originOwnerId,
                                originCityName: movement.originCityName,
                                units: {},
                            };
                        }
                        for (const unitId in movement.units) {
                            newReinforcements[originCityId].units[unitId] = (newReinforcements[originCityId].units[unitId] || 0) + movement.units[unitId];
                        }
                        transaction.update(targetCityRef, { reinforcements: newReinforcements });
                        transaction.update(targetCitySlotRef, { reinforcements: newReinforcements });
                        const reinforceReport = {
                            type: 'reinforce',
                            title: `Reinforcement to ${targetCityState.cityName}`,
                            timestamp: serverTimestamp(),
                            units: movement.units,
                            read: false,
                            originCityName: originCityState.cityName,
                            targetCityName: targetCityState.cityName,
                            originPlayer: {
                                username: movement.originOwnerUsername,
                                id: movement.originOwnerId,
                                cityId: movement.originCityId,
                                x: originCityState.x,
                                y: originCityState.y
                            },
                            targetPlayer: {
                                username: movement.ownerUsername,
                                id: movement.targetOwnerId,
                                cityId: movement.targetCityId,
                                x: targetCityState.x,
                                y: targetCityState.y
                            }
                        };
                        transaction.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), reinforceReport);
                        if (movement.targetOwnerId) {
                            const arrivalReport = {
                                ...reinforceReport,
                                title: `Reinforcements from ${originCityState.cityName}`,
                            };
                            transaction.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), arrivalReport);
                        }
                        transaction.delete(movementDoc.ref);
                    });
                    break;
                }
                case 'trade': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const newTargetResources = { ...targetCityState.resources };
                    for (const resource in movement.resources) {
                        newTargetResources[resource] = (newTargetResources[resource] || 0) + movement.resources[resource];
                    }
                    batch.update(targetCityRef, { resources: newTargetResources });
                    const tradeReport = {
                        type: 'trade',
                        title: `Trade to ${targetCityState.cityName}`,
                        timestamp: serverTimestamp(),
                        resources: movement.resources,
                        read: false,
                        originCityName: originCityState.cityName,
                        targetCityName: targetCityState.cityName,
                        originPlayer: {
                            username: movement.originOwnerUsername,
                            id: movement.originOwnerId,
                            cityId: movement.originCityId,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        targetPlayer: {
                            username: movement.ownerUsername,
                            id: movement.targetOwnerId,
                            cityId: movement.targetCityId,
                            x: targetCityState.x,
                            y: targetCityState.y
                        }
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), tradeReport);
                    const arrivalReport = {
                        type: 'trade',
                        title: `Trade from ${originCityState.cityName}`,
                        timestamp: serverTimestamp(),
                        resources: movement.resources,
                        read: false,
                        originCityName: originCityState.cityName,
                        targetCityName: targetCityState.cityName,
                        originPlayer: {
                            username: movement.originOwnerUsername,
                            id: movement.originOwnerId,
                            cityId: movement.originCityId,
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        targetPlayer: {
                            username: movement.ownerUsername,
                            id: movement.targetOwnerId,
                            cityId: movement.targetCityId,
                            x: targetCityState.x,
                            y: targetCityState.y
                        }
                    };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), arrivalReport);
                    batch.delete(movementDoc.ref);
                    await batch.commit();
                    break;
                }
                case 'return': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }

                    // This logic is for when a RELEASED HERO arrives at their home city.
                    const newCityState = { ...targetCityState };
                    const newHeroes = { ...(newCityState.heroes || {}) };
                    if (movement.hero && newHeroes[movement.hero]) {
                        delete newHeroes[movement.hero].capturedIn; 
                        newHeroes[movement.hero].cityId = movement.targetCityId;
                    }

                    batch.update(targetCityRef, { heroes: newHeroes });
                    batch.delete(movementDoc.ref); // Delete the movement after processing.
                    await batch.commit();
                    break;
                }
                default:
                    console.log(`Unknown movement type: ${movement.type}. Deleting movement ${movement.id}`);
                    batch.delete(movementDoc.ref);
                    await batch.commit();
                    break;
            }
        }
    }, [worldId, getHospitalCapacity]);

    useEffect(() => {
        const processMovements = async () => {
            if (!worldId) return;
            const movementsRef = collection(db, 'worlds', worldId, 'movements');
            const q = query(movementsRef, where('arrivalTime', '<=', new Date()));
            const arrivedMovementsSnapshot = await getDocs(q);
            if (arrivedMovementsSnapshot.empty) return;
            console.log(`Found ${arrivedMovementsSnapshot.docs.length} arrived movements to process.`);
            for (const movementDoc of arrivedMovementsSnapshot.docs) {
                try {
                    await processMovement(movementDoc);
                } catch (error) {
                    console.error("Error processing movement:", movementDoc.id, error);
                }
            }
        };
        const interval = setInterval(processMovements, 5000);
        return () => clearInterval(interval);
    }, [worldId, processMovement]);
};