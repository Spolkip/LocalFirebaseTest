// src/hooks/processors/useAssignmentProcessor.js
import { db } from '../../firebase/config';
import { doc, runTransaction, deleteDoc } from 'firebase/firestore';

export const useAssignmentProcessor = (worldId) => {
    const processHeroAssignment = async (movement) => {
        const targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(targetCityRef);
                if (!cityDoc.exists()) throw new Error("Target city not found.");

                const cityData = cityDoc.data();
                const heroes = cityData.heroes || {};
                const newHeroes = { ...heroes, [movement.hero]: { ...heroes[movement.hero], cityId: movement.targetCityId } };

                transaction.update(targetCityRef, { heroes: newHeroes });
                transaction.delete(doc(db, 'worlds', worldId, 'movements', movement.id));
            });
        } catch (error) {
            console.error("Error processing hero assignment:", error);
            await deleteDoc(doc(db, 'worlds', worldId, 'movements', movement.id));
        }
    };

    return { processHeroAssignment };
};
