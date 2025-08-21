// src/hooks/processors/useAttackProcessor.js
import { db } from '../../firebase/config';
import { doc, getDoc, collection, writeBatch, serverTimestamp, runTransaction, arrayUnion, updateDoc } from 'firebase/firestore';
import { resolveCombat, getVillageTroops } from '../../utils/combat';
import unitConfig from '../../gameData/units.json';
import { v4 as uuidv4 } from 'uuid';

export const useAttackProcessor = (worldId) => {
    const processAttack = async (movement, originCityState, targetCityState, originAllianceData, targetAllianceData) => {
        const batch = writeBatch(db);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
        const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);

        const result = resolveCombat(
            movement.units,
            targetCityState.units,
            targetCityState.resources,
            !!movement.isCrossIsland,
            movement.attackFormation?.front,
            movement.attackFormation?.mid,
            null,
            null,
            movement.hero,
            Object.keys(targetCityState.heroes || {}).find(id => targetCityState.heroes[id].cityId === movement.targetCityId) || null
        );

        await runTransaction(db, async (transaction) => {
            const docsToRead = {
                attackerGameRef: doc(db, `users/${movement.originOwnerId}/games`, worldId),
                defenderGameRef: doc(db, `users/${movement.targetOwnerId}/games`, worldId),
                originCityRef: originCityRef,
                targetCityRef: targetCityRef
            };
            const docsSnap = await Promise.all(Object.values(docsToRead).map(ref => transaction.get(ref)));
            const [attackerGameDoc, defenderGameDoc, originCityDoc, targetCityDoc] = docsSnap;

            // Handle Wounded Hero
            if (result.woundedHero) {
                const { heroId, side } = result.woundedHero;
                const woundedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
                const cityToUpdateRef = side === 'attacker' ? originCityRef : targetCityRef;
                const cityDocToUpdate = side === 'attacker' ? originCityDoc : targetCityDoc;

                if (cityDocToUpdate.exists()) {
                    const cityData = cityDocToUpdate.data();
                    const newHeroes = { ...cityData.heroes };
                    if (newHeroes[heroId]) {
                        newHeroes[heroId].woundedUntil = woundedUntil;
                        transaction.update(cityToUpdateRef, { heroes: newHeroes });
                    }
                }
            }

            // Handle Captured Hero
            if (result.capturedHero) {
                const { heroId, capturedBy } = result.capturedHero;
                const prisonerObject = {
                    captureId: uuidv4(),
                    heroId,
                    capturedAt: new Date(),
                    ownerId: capturedBy === 'attacker' ? movement.targetOwnerId : movement.originOwnerId,
                    ownerUsername: capturedBy === 'attacker' ? movement.ownerUsername : movement.originOwnerUsername,
                    originCityName: capturedBy === 'attacker' ? movement.targetCityName : movement.originCityName,
                    originCityId: capturedBy === 'attacker' ? movement.targetCityId : movement.originCityId,
                };
                let wasImprisoned = false;
                const imprisoningCityRef = capturedBy === 'attacker' ? originCityRef : targetCityRef;
                const imprisoningCitySnap = capturedBy === 'attacker' ? originCityDoc : targetCityDoc;

                if (imprisoningCitySnap.exists()) {
                    const imprisoningCityData = imprisoningCitySnap.data();
                    const prisonLevel = imprisoningCityData.buildings.prison?.level || 0;
                    const capacity = prisonLevel > 0 ? prisonLevel + 4 : 0;
                    const currentPrisoners = imprisoningCityData.prisoners?.length || 0;
                    if (prisonLevel > 0 && currentPrisoners < capacity) {
                        transaction.update(imprisoningCityRef, { prisoners: arrayUnion(prisonerObject) });
                        wasImprisoned = true;

                        const heroOwnerCityRef = capturedBy === 'attacker' ? targetCityRef : originCityRef;
                        const heroOwnerCityDoc = capturedBy === 'attacker' ? targetCityDoc : originCityDoc;
                        if(heroOwnerCityDoc.exists()){
                            const heroOwnerCityData = heroOwnerCityDoc.data();
                            const newHeroes = {...heroOwnerCityData.heroes};
                            if(newHeroes[heroId]){
                                newHeroes[heroId].cityId = null;
                                newHeroes[heroId].status = 'captured';
                                transaction.update(heroOwnerCityRef, {heroes: newHeroes});
                            }
                        }
                    }
                }
                if (!wasImprisoned) {
                    result.capturedHero = null;
                }
            }
            
            // Update Battle Points
            if (attackerGameDoc.exists() && result.attackerBattlePoints > 0) {
                const currentPoints = attackerGameDoc.data().battlePoints || 0;
                transaction.update(docsToRead.attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
            }
            if (defenderGameDoc.exists() && result.defenderBattlePoints > 0) {
                const currentPoints = defenderGameDoc.data().battlePoints || 0;
                transaction.update(docsToRead.defenderGameRef, { battlePoints: currentPoints + result.defenderBattlePoints });
            }
        });

        // Prepare updates for defender's city
        const newDefenderUnits = { ...targetCityState.units };
        for (const unitId in result.defenderLosses) {
            newDefenderUnits[unitId] = Math.max(0, (newDefenderUnits[unitId] || 0) - result.defenderLosses[unitId]);
        }
        const newDefenderResources = { ...targetCityState.resources };
        if (result.attackerWon) {
            newDefenderResources.wood = Math.max(0, newDefenderResources.wood - result.plunder.wood);
            newDefenderResources.stone = Math.max(0, newDefenderResources.stone - result.plunder.stone);
            newDefenderResources.silver = Math.max(0, newDefenderResources.silver - result.plunder.silver);
        }
        batch.update(targetCityRef, { units: newDefenderUnits, resources: newDefenderResources });

        // Prepare reports
        const hasSurvivingLandOrMythic = Object.keys(movement.units).some(unitId => {
            const unit = unitConfig[unitId];
            const survivors = (movement.units[unitId] || 0) - (result.attackerLosses[unitId] || 0);
            return unit && (unit.type === 'land' || unit.mythical) && survivors > 0;
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
        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
        if (movement.targetOwnerId) {
            batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), defenderReport);
        }

        // Handle returning troops
        const survivingAttackers = {};
        for (const unitId in movement.units) {
            const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
            if (survivors > 0) {
                survivingAttackers[unitId] = survivors;
            }
        }
        const heroSurvived = !result.capturedHero || result.capturedHero.heroId !== movement.hero;

        if (Object.keys(survivingAttackers).length > 0 || (movement.hero && heroSurvived) || Object.keys(result.wounded).length > 0) {
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementRef, {
                status: 'returning',
                units: survivingAttackers,
                hero: (movement.hero && heroSurvived) ? movement.hero : null,
                resources: result.plunder,
                wounded: result.wounded,
                arrivalTime: returnArrivalTime,
                involvedParties: [movement.originOwnerId]
            });
        } else {
            batch.delete(movementRef);
        }
        await batch.commit();
    };

    const processVillageAttack = async (movement, originCityState, originAllianceData) => {
        const batch = writeBatch(db);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const villageRef = doc(db, 'worlds', worldId, 'villages', movement.targetVillageId);
        const villageSnap = await getDoc(villageRef);
        if (!villageSnap.exists()) {
            batch.delete(movementRef);
            await batch.commit();
            return;
        }
        const villageData = villageSnap.data();
        const villageTroops = getVillageTroops(villageData);
        const result = resolveCombat(movement.units, villageTroops, villageData.resources, false);
        
        if (result.attackerWon) {
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
            const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
            const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
            batch.update(movementRef, {
                status: 'returning',
                units: survivingAttackers,
                resources: result.plunder,
                wounded: result.wounded,
                arrivalTime: returnArrivalTime,
                involvedParties: [movement.originOwnerId]
            });
        } else {
            batch.delete(movementRef);
        }
        await batch.commit();
    };
    
    // ... processRuinAttack, processGodTownAttack

    return { processAttack, processVillageAttack };
};
