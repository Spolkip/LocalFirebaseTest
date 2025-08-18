// src/hooks/useQuestTracker.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Import useGame
import allQuests from '../gameData/quests.json';
import { getNationalUnitReward, getGenericUnitType } from '../utils/nationality';

// #comment get warehouse capacity based on its level
const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useQuestTracker = (cityState) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId } = useGame(); // Get worldId and activeCityId from context
    const [questProgress, setQuestProgress] = useState(null);
    const [quests, setQuests] = useState([]);
    const [isClaiming, setIsClaiming] = useState(false);

    // Fetch quest progress from Firestore on load and listen for changes
    useEffect(() => {
        if (!currentUser || !worldId) return;

        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');
        const unsubscribe = onSnapshot(questDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setQuestProgress(docSnap.data());
            } else {
                // Initialize if it doesn't exist
                const initialProgress = { completed: {}, claimed: {} };
                setDoc(questDocRef, initialProgress).then(() => {
                    setQuestProgress(initialProgress);
                });
            }
        });

        return () => unsubscribe();
    }, [currentUser, worldId]);

    // Update quest status when cityState or progress changes
    useEffect(() => {
        if (!cityState || !questProgress) {
            setQuests([]);
            return;
        }

        const updatedQuests = Object.entries(allQuests).map(([id, questData]) => {
            let isComplete = false;
            if (questProgress.completed[id]) {
                isComplete = true;
            } else {
                switch (questData.type) {
                    case 'building':
                        if (cityState.buildings[questData.targetId]?.level >= questData.targetLevel) {
                            isComplete = true;
                        }
                        break;
                    case 'units':
                        // #comment Sum up all units of the target generic type by checking their national equivalent
                        const totalCount = Object.entries(cityState.units || {})
                            .reduce((sum, [unitId, count]) => {
                                if (getGenericUnitType(unitId) === questData.targetId || unitId === questData.targetId) {
                                    return sum + count;
                                }
                                return sum;
                            }, 0);

                        if (totalCount >= questData.targetCount) {
                            isComplete = true;
                        }
                        break;
                    default:
                        break;
                }
            }

            return {
                id,
                ...questData,
                isComplete,
                isClaimed: !!questProgress.claimed[id],
            };
        });

        setQuests(updatedQuests);

    }, [cityState, questProgress]);

    const claimReward = useCallback(async (questId) => {
        if (isClaiming) return;
        if (!currentUser || !worldId || !activeCityId) return;

        const quest = quests.find(q => q.id === questId);
        if (!quest || !quest.isComplete || quest.isClaimed) {
            console.error("Quest not available for claiming.");
            return;
        }

        setIsClaiming(true);

        const cityDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/cities`, activeCityId);
        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                const questDoc = await transaction.get(questDocRef);

                if (!cityDoc.exists() || !questDoc.exists()) {
                    throw new Error("City or quest data not found.");
                }

                const cityData = cityDoc.data();
                const questData = questDoc.data();
                const capacity = getWarehouseCapacity(cityData.buildings.warehouse?.level);

                // Apply rewards
                const newResources = { ...cityData.resources };
                const newUnits = { ...cityData.units };
                const playerNation = cityData.playerInfo?.nation;

                if (quest.rewards.resources) {
                    for (const resource in quest.rewards.resources) {
                        newResources[resource] = Math.min(capacity, (newResources[resource] || 0) + quest.rewards.resources[resource]);
                    }
                }
                if (quest.rewards.units) {
                    for (const unit in quest.rewards.units) {
                        // #comment Check for a generic unit reward
                        if (unit.startsWith('generic_')) {
                            if (!playerNation) {
                                console.error("Player nation not found for generic unit reward.");
                                continue;
                            }
                            const nationalUnitId = getNationalUnitReward(playerNation, unit);
                            newUnits[nationalUnitId] = (newUnits[nationalUnitId] || 0) + quest.rewards.units[unit];
                        } else {
                            newUnits[unit] = (newUnits[unit] || 0) + quest.rewards.units[unit];
                        }
                    }
                }

                // Update quest progress
                const newQuestProgress = { ...questData };
                newQuestProgress.claimed[questId] = true;
                if (!newQuestProgress.completed[questId]) {
                    newQuestProgress.completed[questId] = true;
                }

                transaction.update(cityDocRef, { resources: newResources, units: newUnits });
                transaction.set(questDocRef, newQuestProgress);
            });
            // The onSnapshot listener will update the local state automatically.
        } catch (error) {
            console.error("Error claiming quest reward:", error);
        } finally {
            setIsClaiming(false);
        }
    }, [currentUser, worldId, activeCityId, quests, isClaiming]);

    return { quests, claimReward, isClaiming };
};
