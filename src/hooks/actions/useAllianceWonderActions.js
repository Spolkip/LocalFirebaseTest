// src/hooks/actions/useAllianceWonderActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp } from "firebase/firestore";
import allianceWonders from '../../gameData/alliance_wonders.json';

// #comment Calculate the total cost to build a wonder level
const getWonderCost = (level) => {
    const costMultiplier = Math.pow(1.5, level);
    return {
        wood: Math.floor(100000 * costMultiplier),
        stone: Math.floor(100000 * costMultiplier),
        silver: Math.floor(50000 * costMultiplier)
    };
};

// #comment Get the current progress of the wonder
export const getWonderProgress = (alliance, wonderId) => {
    const progress = alliance?.wonderProgress?.[wonderId] || { wood: 0, stone: 0, silver: 0 };
    return progress;
};

// #comment This hook contains actions related to alliance wonders.
export const useAllianceWonderActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState } = useGame();

    const startWonder = async (wonderId, islandId, coords) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (playerAlliance.leader.uid !== currentUser.uid) throw new Error("Only the leader can start a wonder.");
        if (playerAlliance.allianceWonder) throw new Error("Your alliance is already building a wonder.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', gameState.id);
        const eventRef = doc(collection(allianceDocRef, 'events'));
        const startCost = { wood: 50000, stone: 50000, silver: 25000 };

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            if (!cityDoc.exists()) throw new Error("Your city data was not found.");
            const cityData = cityDoc.data();

            for (const resource in startCost) {
                if ((cityData.resources[resource] || 0) < startCost[resource]) {
                    throw new Error(`You do not have enough ${resource} to start the wonder.`);
                }
            }

            const newPlayerResources = { ...cityData.resources };
            for (const resource in startCost) {
                newPlayerResources[resource] -= startCost[resource];
            }

            transaction.update(cityDocRef, { resources: newPlayerResources });

            transaction.update(allianceDocRef, {
                allianceWonder: { id: wonderId, level: 0, islandId, x: coords.x, y: coords.y },
                wonderProgress: { [wonderId]: { wood: 0, stone: 0, silver: 0 } }
            });

            const eventText = `${userProfile.username} has started construction of the ${allianceWonders[wonderId].name}.`;
            transaction.set(eventRef, {
                type: 'wonder_start',
                text: eventText,
                timestamp: serverTimestamp()
            });
        });
    };

    const donateToWonder = async (wonderId, donation) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', gameState.id);
        const eventRef = doc(collection(allianceDocRef, 'events'));

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");

            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            
            const currentWonder = allianceData.allianceWonder;
            if (!currentWonder || currentWonder.id !== wonderId) throw new Error("Cannot donate to this wonder, as it is not the active wonder.");

            const newPlayerResources = { ...cityData.resources };
            const newWonderProgress = { ...(allianceData.wonderProgress?.[wonderId] || { wood: 0, stone: 0, silver: 0 }) };

            for (const resource in donation) {
                if ((newPlayerResources[resource] || 0) < donation[resource]) throw new Error(`Not enough ${resource} in your city.`);
                newPlayerResources[resource] -= donation[resource];
                newWonderProgress[resource] += donation[resource];
            }

            transaction.update(cityDocRef, { resources: newPlayerResources });
            transaction.update(allianceDocRef, { [`wonderProgress.${wonderId}`]: newWonderProgress });

            const donationAmounts = Object.entries(donation).filter(([,a]) => a > 0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ');
            if (donationAmounts) {
                transaction.set(eventRef, {
                    type: 'wonder_donation',
                    text: `${userProfile.username} donated ${donationAmounts} to the wonder.`,
                    timestamp: serverTimestamp()
                });
            }
        });
    };

    const claimWonderLevel = async (wonderId) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (playerAlliance.leader.uid !== currentUser.uid) throw new Error("Only the leader can claim wonder levels.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!allianceDoc.exists()) throw new Error("Alliance data not found.");

            const allianceData = allianceDoc.data();
            const currentWonder = allianceData.allianceWonder;
            const progress = allianceData.wonderProgress[wonderId] || { wood: 0, stone: 0, silver: 0 };
            const nextLevel = currentWonder.level + 1;
            const cost = getWonderCost(nextLevel -1);

            if (progress.wood < cost.wood || progress.stone < cost.stone || progress.silver < cost.silver) {
                throw new Error("Not enough resources have been donated to claim this level.");
            }

            const newProgress = {
                wood: progress.wood - cost.wood,
                stone: progress.stone - cost.stone,
                silver: progress.silver - cost.silver,
            };

            transaction.update(allianceDocRef, {
                allianceWonder: { ...currentWonder, level: nextLevel },
                [`wonderProgress.${wonderId}`]: newProgress
            });
        });
    };

    const demolishWonder = async () => {
         if (!playerAlliance) throw new Error("You are not in an alliance.");
         if (playerAlliance.leader.uid !== currentUser.uid) throw new Error("Only the leader can demolish the wonder.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!allianceDoc.exists()) throw new Error("Alliance data not found.");

            transaction.update(allianceDocRef, { allianceWonder: null, wonderProgress: {} });
        });
    };

    return { startWonder, donateToWonder, claimWonderLevel, demolishWonder };
};