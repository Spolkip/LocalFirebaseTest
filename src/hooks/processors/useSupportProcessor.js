// src/hooks/processors/useSupportProcessor.js
import { db } from '../../firebase/config';
import { doc, collection, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';

export const useSupportProcessor = (worldId) => {
    const processReinforce = async (movement, targetCityState, originCityState) => {
        const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        const targetCitySlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);

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
                units: movement.units || {},
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
            transaction.delete(movementRef);
        });
    };

    const processTrade = async (movement, targetCityState, originCityState) => {
        const batch = writeBatch(db);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        
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
            ...tradeReport,
            title: `Trade from ${originCityState.cityName}`,
        };
        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), arrivalReport);
        batch.delete(movementRef);
        await batch.commit();
    };

    return { processReinforce, processTrade };
};
