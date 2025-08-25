// src/hooks/actions/useHeroActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp, getDocs, deleteField } from 'firebase/firestore';
import heroesConfig from '../../gameData/heroes.json';
import { calculateDistance, calculateTravelTime } from '../../utils/travel';

export const useHeroActions = (cityGameState, saveGameState, setMessage) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId} = useGame();

    const onRecruitHero = async (heroId) => {
        const hero = heroesConfig[heroId];
        if (!hero) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const cityData = cityDoc.data();
                if (cityData.resources.silver < hero.cost.silver) throw new Error("Not enough silver.");
                if ((cityData.worship[cityData.god] || 0) < hero.cost.favor) throw new Error("Not enough favor.");

                const newResources = { ...cityData.resources, silver: cityData.resources.silver - hero.cost.silver };
                const newWorship = { ...cityData.worship, [cityData.god]: cityData.worship[cityData.god] - hero.cost.favor };
                
                const updates = {
                    resources: newResources,
                    worship: newWorship,
                    [`heroes.${heroId}`]: { active: true, cityId: null, level: 1, xp: 0 }
                };

                transaction.update(cityDocRef, updates);
            });
            setMessage(`${hero.name} has been recruited!`);
        } catch (error) {
            setMessage(`Failed to recruit hero: ${error.message}`);
        }
    };

    const onActivateSkill = async (heroId, skill) => {
        const hero = heroesConfig[heroId];
        if (!hero) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const cityData = cityDoc.data();
                const heroData = cityData.heroes?.[heroId] || { level: 1 };
                const favorCost = skill.cost.favor;
                const currentSkillCost = (favorCost.base || 0) + ((heroData.level - 1) * (favorCost.perLevel || 0));

                if ((cityData.worship?.[cityData.god] || 0) < currentSkillCost) {
                    throw new Error("Not enough favor.");
                }

                const activeSkills = cityData.activeSkills || {};
                const now = Date.now();
                if (activeSkills[skill.name] && now < activeSkills[skill.name].expires) {
                    const timeLeft = Math.ceil((activeSkills[skill.name].expires - now) / 1000);
                    throw new Error(`Skill is on cooldown. Time left: ${timeLeft}s`);
                }

                const newWorship = { ...cityData.worship, [cityData.god]: cityData.worship[cityData.god] - currentSkillCost };

                let newBuffs = { ...(cityData.buffs || {}) };
                const newActiveSkills = { ...activeSkills };

                const skillCooldown = (skill.cooldown || 0) * 1000;
                newActiveSkills[skill.name] = {
                    activatedAt: now,
                    expires: now + skillCooldown
                };

                const effectValue = (skill.effect.baseValue || 0) + ((heroData.level - 1) * (skill.effect.valuePerLevel || 0));

                if (skill.effect.type === 'troop_buff') {
                    newBuffs.battle = {
                        ...(newBuffs.battle || {}),
                        [skill.effect.subtype]: {
                            value: effectValue,
                            unit_type: skill.effect.unit_type
                        }
                    };
                } else if (skill.effect.type === 'city_buff') {
                    const skillDuration = (skill.effect.duration || 0) * 1000;
                    newBuffs.city = {
                        ...(newBuffs.city || {}),
                        [skill.effect.subtype]: {
                            value: effectValue,
                            expires: now + skillDuration
                        }
                    };
                }

                transaction.update(cityDocRef, {
                    worship: newWorship,
                    buffs: newBuffs,
                    activeSkills: newActiveSkills
                });
            });
            setMessage(`${skill.name} has been activated!`);
        } catch (error) {
            setMessage(`Failed to activate skill: ${error.message}`);
        }
    };

    const onAssignHero = async (heroId) => {
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
    
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
    
                const cityData = cityDoc.data();
                const heroes = cityData.heroes || {};
    
                for (const hId in heroes) {
                    if (heroes[hId].cityId === activeCityId) {
                        throw new Error("Another hero is already stationed in this city.");
                    }
                }
    
                const distance = calculateDistance({ x: 0, y: 0 }, { x: cityData.x, y: cityData.y });
                const travelSeconds = calculateTravelTime(distance, 10);
                const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
    
                const movementData = {
                    type: 'assign_hero',
                    status: 'moving',
                    hero: heroId,
                    originCityId: null,
                    originCoords: { x: -1, y: -1 },
                    targetCityId: activeCityId,
                    targetCoords: { x: cityData.x, y: cityData.y },
                    targetOwnerId: currentUser.uid,
                    departureTime: serverTimestamp(),
                    arrivalTime: arrivalTime,
                    involvedParties: [currentUser.uid]
                };
    
                transaction.set(newMovementRef, movementData);
            });
            setMessage(`${heroesConfig[heroId].name} is on their way to this city.`);
        } catch (error) {
            setMessage(`Failed to assign hero: ${error.message}`);
        }
    };

    const onUnassignHero = async (heroId) => {
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                transaction.update(cityDocRef, { [`heroes.${heroId}.cityId`]: null });
            });
            setMessage(`${heroesConfig[heroId].name} is no longer stationed in this city.`);
        } catch (error) {
            setMessage(`Failed to unassign hero: ${error.message}`);
        }
    };

    const onReleaseHero = async (prisonerToRelease) => {
        if (!prisonerToRelease || !prisonerToRelease.captureId) {
            setMessage("Invalid prisoner data.");
            return;
        }
    
        const capturingCityRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        
        try {
            // #comment Fetch all cities of the hero's owner BEFORE the transaction
            const heroOwnerCitiesRef = collection(db, `users/${prisonerToRelease.ownerId}/games`, worldId, 'cities');
            const heroOwnerCitiesSnap = await getDocs(heroOwnerCitiesRef);

            await runTransaction(db, async (transaction) => {
                const capturingCityDoc = await transaction.get(capturingCityRef);
    
                if (!capturingCityDoc.exists()) throw new Error("Your city data could not be found.");
    
                const capturingCityData = capturingCityDoc.data();
                const currentPrisoners = capturingCityData.prisoners || [];
                const newPrisoners = currentPrisoners.filter(p => p.captureId !== prisonerToRelease.captureId);
    
                if (newPrisoners.length === currentPrisoners.length) {
                    throw new Error("Could not find the specified prisoner to release.");
                }
    
                transaction.update(capturingCityRef, { prisoners: newPrisoners });
    
                // #comment Atomically remove the 'capturedIn' field without overwriting other hero data.
                heroOwnerCitiesSnap.forEach(cityDoc => {
                    // We only need to update if the hero object exists in this city's data.
                    if (cityDoc.data().heroes?.[prisonerToRelease.heroId]) {
                        transaction.update(cityDoc.ref, {
                            [`heroes.${prisonerToRelease.heroId}.capturedIn`]: deleteField()
                        });
                    }
                });
    
                // Create a return movement for the hero
                const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
                const heroOwnerCityCoords = prisonerToRelease.originCityCoords;
                if (!heroOwnerCityCoords) {
                    throw new Error("Released hero's home city coordinates not found.");
                }
    
                const distance = calculateDistance(capturingCityData, heroOwnerCityCoords);
                const travelSeconds = calculateTravelTime(distance, 10); // Use a base speed for heroes
                const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
    
                const movementData = {
                    type: 'return',
                    status: 'moving',
                    hero: prisonerToRelease.heroId,
                    originCityId: activeCityId,
                    originCoords: { x: capturingCityData.x, y: capturingCityData.y },
                    originOwnerId: currentUser.uid,
                    originCityName: capturingCityData.cityName,
                    targetCityId: prisonerToRelease.originCityId,
                    targetCoords: { x: heroOwnerCityCoords.x, y: heroOwnerCityCoords.y },
                    targetOwnerId: prisonerToRelease.ownerId,
                    departureTime: serverTimestamp(),
                    arrivalTime: arrivalTime,
                    involvedParties: [currentUser.uid, prisonerToRelease.ownerId]
                };
                transaction.set(newMovementRef, movementData);
            });
            setMessage(`${heroesConfig[prisonerToRelease.heroId].name} has been released and is returning home.`);
        } catch (error) {
            setMessage(`Failed to release hero: ${error.message}`);
            console.error(error);
        }
    };

    return { onRecruitHero, onActivateSkill, onAssignHero, onUnassignHero, onReleaseHero };
};