// src/hooks/processors/useReturnProcessor.js
import { db } from '../../firebase/config';
import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useCityState } from '../useCityState';

const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useReturnProcessor = (worldId) => {
    const { getHospitalCapacity } = useCityState(worldId);

    const processReturn = async (movement, originCityState) => {
        const batch = writeBatch(db);
        const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);

        const newCityState = { ...originCityState };
        const newUnits = { ...newCityState.units };
        for (const unitId in movement.units) {
            newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
        }

        if (movement.agent) {
            const newAgents = { ...(newCityState.agents || {}) };
            newAgents[movement.agent] = (newAgents[movement.agent] || 0) + 1;
            batch.update(originCityRef, { agents: newAgents });
        }

        if (movement.hero) {
            const newHeroes = { ...(newCityState.heroes || {}) };
            if (newHeroes[movement.hero]) {
                newHeroes[movement.hero].cityId = null;
                delete newHeroes[movement.hero].status; // Clear captured status
            }
            batch.update(originCityRef, { heroes: newHeroes });
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
        batch.delete(movementRef);
        await batch.commit();
        console.log(`Movement ${movement.id} processed and deleted.`);
    };

    return { processReturn };
};
