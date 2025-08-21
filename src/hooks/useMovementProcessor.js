// src/hooks/useMovementProcessor.js
import { useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAssignmentProcessor } from './processors/useAssignmentProcessor';
import { useFoundingProcessor } from './processors/useFoundingProcessor';
import { useReturnProcessor } from './processors/useReturnProcessor';
import { useAttackProcessor } from './processors/useAttackProcessor';
import { useScoutProcessor } from './processors/useScoutProcessor';
import { useSupportProcessor } from './processors/useSupportProcessor';

export const useMovementProcessor = (worldId) => {
    const { processHeroAssignment } = useAssignmentProcessor(worldId);
    const { processFoundCity } = useFoundingProcessor(worldId);
    const { processReturn } = useReturnProcessor(worldId);
    const { processAttack, processVillageAttack } = useAttackProcessor(worldId);
    const { processScout } = useScoutProcessor(worldId);
    const { processReinforce, processTrade } = useSupportProcessor(worldId);

    const processMovement = useCallback(async (movementDoc) => {
        console.log(`Processing movement ID: ${movementDoc.id}`);
        const movement = { id: movementDoc.id, ...movementDoc.data() };

        if (movement.type === 'assign_hero') {
            await processHeroAssignment(movement);
            return;
        }
        if (movement.type === 'found_city') {
            await processFoundCity(movement);
            return;
        }

        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
        const originCitySnap = await getDoc(originCityRef);
        if (!originCitySnap.exists()) {
            console.log(`Origin city for movement ${movement.id} not found. Deleting movement.`);
            await deleteDoc(movementDoc.ref);
            return;
        }
        const originCityState = originCitySnap.data();

        if (movement.status === 'returning') {
            await processReturn(movement, originCityState);
            return;
        }

        if (movement.status === 'moving') {
            let targetCityRef, targetCitySnap, targetCityState;
            if (movement.targetOwnerId && movement.targetCityId) {
                targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
                targetCitySnap = await getDoc(targetCityRef);
                targetCityState = targetCitySnap.exists() ? targetCitySnap.data() : null;
            }

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

            switch (movement.type) {
                case 'attack':
                    if (targetCityState) {
                        await processAttack(movement, originCityState, targetCityState, originAllianceData, targetAllianceData);
                    } else {
                        await deleteDoc(movementDoc.ref);
                    }
                    break;
                case 'attack_village':
                    await processVillageAttack(movement, originCityState, originAllianceData);
                    break;
                // ... other attack types
                case 'scout':
                    if (targetCityState) {
                        await processScout(movement, originCityState, targetCityState, originAllianceData, targetAllianceData);
                    } else {
                        await deleteDoc(movementDoc.ref);
                    }
                    break;
                case 'reinforce':
                    if (targetCityState) {
                        await processReinforce(movement, targetCityState, originCityState);
                    } else {
                        await deleteDoc(movementDoc.ref);
                    }
                    break;
                case 'trade':
                     if (targetCityState) {
                        await processTrade(movement, targetCityState, originCityState);
                    } else {
                        await deleteDoc(movementDoc.ref);
                    }
                    break;
                default:
                    console.log(`Unknown movement type: ${movement.type}. Deleting movement ${movement.id}`);
                    await deleteDoc(movementDoc.ref);
                    break;
            }
        }
    }, [worldId, processHeroAssignment, processFoundCity, processReturn, processAttack, processVillageAttack, processScout, processReinforce, processTrade]);

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
