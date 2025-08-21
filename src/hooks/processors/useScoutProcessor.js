// src/hooks/processors/useScoutProcessor.js
import { db } from '../../firebase/config';
import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { resolveScouting } from '../../utils/combat';

export const useScoutProcessor = (worldId) => {
    const processScout = async (movement, originCityState, targetCityState, originAllianceData, targetAllianceData) => {
        const batch = writeBatch(db);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);

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
        batch.delete(movementRef);
        await batch.commit();
    };

    return { processScout };
};
