// src/hooks/processors/useFoundingProcessor.js
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import buildingConfig from '../../gameData/buildings.json';

export const useFoundingProcessor = (worldId) => {
    const processFoundCity = async (movement) => {
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const targetSlotRef = doc(db, 'worlds', worldId, 'citySlots', movement.targetSlotId);
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);

        if (movement.status === 'moving') {
            const newArrivalTime = new Date(Date.now() + movement.foundingTimeSeconds * 1000);
            await updateDoc(movementRef, {
                status: 'founding',
                arrivalTime: newArrivalTime,
            });
            return;
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
                        transaction.delete(movementRef);
                        return;
                    }
                    if (!targetSlotSnap.exists() || targetSlotSnap.data().ownerId !== null) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        transaction.update(movementRef, {
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
                    transaction.delete(movementRef);
                });
            } catch (error) {
                console.error("Error in found_city transaction:", error);
                await deleteDoc(movementRef);
            }
        }
    };

    return { processFoundCity };
};
