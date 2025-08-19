// src/hooks/useCityState.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc, serverTimestamp} from 'firebase/firestore'; 
import { db } from '../firebase/config';
import buildingConfig from '../gameData/buildings.json';
import unitConfig from '../gameData/units.json';
import researchConfig from '../gameData/research.json';
import heroesConfig from '../gameData/heroes.json';
import { useGame } from '../contexts/GameContext';
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique IDs
import { useAlliance } from '../contexts/AllianceContext';
import allianceWonders from '../gameData/alliance_wonders.json';

// #comment This is now a pure utility function that can be imported anywhere.
export const calculateTotalPointsForCity = (gameState, playerAlliance) => {
    if (!gameState) return 0;
    let points = 0;
    if (gameState.buildings) {
        for (const buildingId in gameState.buildings) {
            const buildingData = gameState.buildings[buildingId];
            const buildingInfo = buildingConfig[buildingId];
            if (buildingInfo && buildingInfo.points) {
                const level = buildingData.level;
                points += buildingInfo.points * (level * (level + 1) / 2);
            }
        }
    }
    if (gameState.units) {
        for (const unitId in gameState.units) {
            const unit = unitConfig[unitId];
            if (unit) points += gameState.units[unitId] * (unit.cost.population || 1);
        }
    }
    if (gameState.research) {
        points += Object.keys(gameState.research).length * 50;
    }
    
    if (playerAlliance?.allianceWonder) {
        points += 500;
    }
    return Math.floor(points);
};


const getMarketCapacity = (level) => {
    if (!level || level < 1) return 0;
    const capacity = 500 + (level - 1) * 200;
    return Math.min(2500, capacity);
};

export const useCityState = (worldId, isInstantBuild, isInstantResearch, isInstantUnits) => {
    const { currentUser } = useAuth();
    const { activeCityId, addNotification } = useGame(); // #comment Get addNotification from context
    const { playerAlliance } = useAlliance();
    const [cityGameState, setCityGameState] = useState(null);
    const gameStateRef = useRef(cityGameState);

    useEffect(() => {
        gameStateRef.current = cityGameState;
    }, [cityGameState]);

    // #comment Calculates city happiness details: base gain, penalty, and total.
    const getHappinessDetails = useCallback((buildings) => {
        if (!buildings || !buildings.senate) return { base: 0, penalty: 0, total: 0 };
        const base = buildings.senate.level * 10;

        let workerCount = 0;
        const productionBuildings = ['timber_camp', 'quarry', 'silver_mine'];
        productionBuildings.forEach(buildingId => {
            if (buildings[buildingId] && buildings[buildingId].workers) {
                // #comment FIX: Ensure workers is treated as a number to prevent NaN propagation.
                workerCount += Number(buildings[buildingId].workers || 0);
            }
        });

        const penalty = workerCount * 5;
        const total = Math.max(0, Math.min(100, base - penalty));
        return { base, penalty, total };
    }, []);

    // #comment Calculates city happiness based on Senate level and worker upkeep.
    const calculateHappiness = useCallback((buildings) => {
        if (!buildings || !buildings.senate) return 0;
        const details = getHappinessDetails(buildings);
        
        let happiness = details.total;
        if (playerAlliance?.allianceWonder?.id === 'shrine_of_the_ancestors') {
             happiness += allianceWonders.shrine_of_the_ancestors.bonus.value * 100;
        }

        return Math.min(100, happiness);
    }, [getHappinessDetails, playerAlliance]);
    
    const getMaxWorkerSlots = useCallback((level) => {
        if (!level || level < 1) return 0;
        return Math.min(6, 1 + Math.floor(level / 5));
    }, []);

    // #comment Calculates resource production rates, applying happiness bonuses or penalties.
    const getProductionRates = useCallback((buildings) => {
        if (!buildings) return { wood: 0, stone: 0, silver: 0 };
        
        const happiness = calculateHappiness(buildings);
        const happinessBonus = happiness > 70 ? 1.10 : (happiness < 40 ? 0.9 : 1.0); // Bonus when happy, penalty when unhappy

        const rates = {
            wood: Math.floor(30 * Math.pow(1.2, (buildings.timber_camp?.level || 1) - 1)),
            stone: Math.floor(30 * Math.pow(1.2, (buildings.quarry?.level || 1) - 1)),
            silver: Math.floor(15 * Math.pow(1.15, (buildings.silver_mine?.level || 1) - 1)),
        };

        // #comment Safeguard against NaN values from worker counts
        if (buildings.timber_camp?.workers) {
            const workerCount = Number(buildings.timber_camp.workers) || 0;
            rates.wood *= (1 + workerCount * 0.1);
        }
        if (buildings.quarry?.workers) {
            const workerCount = Number(buildings.quarry.workers) || 0;
            rates.stone *= (1 + workerCount * 0.1);
        }
        if (buildings.silver_mine?.workers) {
            const workerCount = Number(buildings.silver_mine.workers) || 0;
            rates.silver *= (1 + workerCount * 0.1);
        }

        // Apply passive hero buffs
        if (cityGameState?.heroes) {
            for (const heroId in cityGameState.heroes) {
                if (cityGameState.heroes[heroId].cityId === activeCityId) {
                    const hero = heroesConfig[heroId];
                    if (hero.passive.effect.subtype === 'silver_production') {
                        rates.silver *= (1 + hero.passive.effect.value);
                    }
                }
            }
        }

        // Apply alliance research buffs
        if (playerAlliance?.research) {
            const woodBoostLevel = playerAlliance.research.forestry_experts?.level || 0;
            const stoneBoostLevel = playerAlliance.research.masonry_techniques?.level || 0;
            const silverBoostLevel = playerAlliance.research.coinage_reform?.level || 0;

            rates.wood *= (1 + woodBoostLevel * 0.02);
            rates.stone *= (1 + stoneBoostLevel * 0.02);
            rates.silver *= (1 + silverBoostLevel * 0.02);
        }

        rates.wood = Math.floor(rates.wood * happinessBonus);
        rates.stone = Math.floor(rates.stone * happinessBonus);
        rates.silver = Math.floor(rates.silver * happinessBonus);

        return rates;
    }, [calculateHappiness, cityGameState, activeCityId, playerAlliance]);

    // #comment Adjusted warehouse capacity for better resource balance.
    const getWarehouseCapacity = useCallback((level) => {
        if (!level) return 0;
        let capacity = Math.floor(1500 * Math.pow(1.4, level - 1));
        
        if (playerAlliance?.research) {
            const warehouseBoostLevel = playerAlliance.research.advanced_storage?.level || 0;
            capacity *= (1 + warehouseBoostLevel * 0.05);
        }

        return Math.floor(capacity);
    }, [playerAlliance]);

    // #comment Adjusted farm capacity for better population balance.
    const getFarmCapacity = useCallback((level) => {
        if (!level) return 0;
        let capacity = Math.floor(200 * Math.pow(1.25, level - 1));
        if (playerAlliance?.allianceWonder?.id === 'shrine_of_the_ancestors') {
            capacity *= (1 + allianceWonders.shrine_of_the_ancestors.bonus.value);
        }
        return capacity;
    }, [playerAlliance]);

    const getHospitalCapacity = useCallback((level) => {
        if (!level) return 0;
        return level * 1000;
    }, []);

    const getUpgradeCost = useCallback((buildingId, level) => {
        const building = buildingConfig[buildingId];
        if (!building || level < 1) return { wood: 0, stone: 0, silver: 0, population: 0, time: 0 };
        
        const cost = building.baseCost;
        let populationCost = Math.floor(cost.population * Math.pow(1.1, level - 1));
        const initialBuildings = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave', 'hospital'];
        if (level === 1 && initialBuildings.includes(buildingId)) {
          populationCost = 0;
        }

        const calculatedTime = Math.floor(cost.time * Math.pow(1.25, level - 1));

        return {
            wood: Math.floor(cost.wood * Math.pow(1.6, level - 1)),
            stone: Math.floor(cost.stone * Math.pow(1.6, level - 1)),
            silver: Math.floor(cost.silver * Math.pow(1.8, level - 1)),
            population: populationCost,
            time: isInstantBuild ? 1 : calculatedTime,
        };
    }, [isInstantBuild]);
    
    const getResearchCost = useCallback((researchId) => {
        const research = researchConfig[researchId];
        if (!research) return null;
        
        let time = research.cost.time;
        if (playerAlliance?.allianceWonder?.id === 'great_forum') {
            time *= (1 - allianceWonders.great_forum.bonus.value);
        }

        return {
            wood: research.cost.wood,
            stone: research.cost.stone,
            silver: research.cost.silver,
            time: isInstantResearch ? 1 : time,
        };
    }, [isInstantResearch, playerAlliance]);

    const calculateUsedPopulation = useCallback((gameState) => {
        if (!gameState) return 0;
        const { buildings, units, specialBuilding, barracksQueue, shipyardQueue, divineTempleQueue } = gameState;

        let used = 0;
        if (buildings) {
          for (const buildingId in buildings) {
            const buildingData = buildings[buildingId];
            const startLevel = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave', 'hospital'].includes(buildingId) ? 1 : 0;
            for (let i = startLevel; i <= buildingData.level; i++) {
              if (i > 0) {
                used += getUpgradeCost(buildingId, i).population;
              }
            }
            if (buildingData.workers) {
                used += buildingData.workers * 20;
            }
          }
        }
        if (units) {
          for (const unitId in units) {
            used += (unitConfig[unitId]?.cost.population || 0) * units[unitId];
          }
        }
        if (specialBuilding) {
            used += 60;
        }
        
        const queues = [barracksQueue || [], shipyardQueue || [], divineTempleQueue || []];
        queues.forEach(queue => {
            queue.forEach(task => {
                const unit = unitConfig[task.unitId];
                if (unit) {
                    used += (unit.cost.population || 0) * task.amount;
                }
            });
        });

        return used;
    }, [getUpgradeCost]);

    // #comment Calculates total points from buildings, units, and research.
    const calculateTotalPoints = useCallback((gameState) => {
        return calculateTotalPointsForCity(gameState, playerAlliance);
    }, [playerAlliance]);

    const saveGameState = useCallback(async (stateToSave) => {
        if (!currentUser || !worldId || !activeCityId || !stateToSave) return;
        try {
            const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
            
            // #comment Apply warehouse capacity limit before saving
            const capacity = getWarehouseCapacity(stateToSave.buildings?.warehouse?.level);
            const cappedResources = {
                wood: Math.min(capacity, stateToSave.resources.wood || 0),
                stone: Math.min(capacity, stateToSave.resources.stone || 0),
                silver: Math.min(capacity, stateToSave.resources.silver || 0),
            };

            const dataToSave = { 
                ...stateToSave, 
                resources: { ...stateToSave.resources, ...cappedResources },
                lastUpdated: Date.now() 
            };
            
            await setDoc(cityDocRef, dataToSave, { merge: true });
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }, [currentUser, worldId, activeCityId, getWarehouseCapacity]);

    useEffect(() => {
        if (!currentUser || !worldId || !activeCityId) {
            setCityGameState(null);
            return;
        }
        // #comment This now listens to the specific city document based on activeCityId
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const unsubscribe = onSnapshot(cityDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // #comment Ensure all top-level properties and buildings exist to prevent crashes
                if (!data.buildings) data.buildings = {};
                for (const buildingId in buildingConfig) {
                    if (!data.buildings[buildingId]) {
                        data.buildings[buildingId] = { level: 0 };
                    }
                }

                if (!data.units) data.units = {};
                if (!data.wounded) data.wounded = {};
                if (!data.worship) data.worship = {};
                if (!data.cave) data.cave = { silver: 0 }; 
                if (!data.research) data.research = {};
                if (!data.buildQueue) data.buildQueue = [];
                // Initialize new separate queues
                if (!data.barracksQueue) data.barracksQueue = [];
                if (!data.shipyardQueue) data.shipyardQueue = [];
                if (!data.divineTempleQueue) data.divineTempleQueue = [];
                // Retain healQueue
                if (!data.healQueue) data.healQueue = [];
                
                // #comment Helper to convert Firestore Timestamps to JS Dates and assign IDs if missing
                const convertAndAssignIds = (queue) => (queue || []).map(task => ({
                    id: task.id || uuidv4(), // Assign ID if missing
                    ...task,
                    endTime: task.endTime?.toDate ? task.endTime.toDate() : task.endTime
                }));
    
                data.buildQueue = convertAndAssignIds(data.buildQueue);
                data.barracksQueue = convertAndAssignIds(data.barracksQueue);
                data.shipyardQueue = convertAndAssignIds(data.shipyardQueue);
                data.divineTempleQueue = convertAndAssignIds(data.divineTempleQueue);
                data.researchQueue = convertAndAssignIds(data.researchQueue);
                data.healQueue = convertAndAssignIds(data.healQueue);

                setCityGameState(data);
            } else {
                setCityGameState(null);
            }
        });
        return () => unsubscribe();
    }, [currentUser, worldId, activeCityId]);

    useEffect(() => {
        if (!activeCityId) return; // #comment Don't run interval if no city is active
    
        const interval = setInterval(() => {
            setCityGameState(prevState => {
                if (!prevState) return prevState;
                const now = Date.now();
                
                // #FIX: Correctly handle both number and Firestore Timestamp for lastUpdated
                const lastUpdateTimestamp = prevState.lastUpdated?.toDate ? prevState.lastUpdated.toDate().getTime() : prevState.lastUpdated;
                const lastUpdate = lastUpdateTimestamp || now;
                const elapsedSeconds = (now - lastUpdate) / 1000;
                
                // #FIX: Prevent negative elapsed time if clocks are out of sync
                if (elapsedSeconds < 0) return prevState;

                const newState = JSON.parse(JSON.stringify(prevState));
                
                const productionRates = getProductionRates(newState.buildings);
                const capacity = getWarehouseCapacity(newState.buildings?.warehouse?.level);

                // #comment Add NaN checks to prevent invalid resource values
                newState.resources.wood = Math.min(capacity, (prevState.resources.wood || 0) + (productionRates.wood / 3600) * elapsedSeconds);
                newState.resources.stone = Math.min(capacity, (prevState.resources.stone || 0) + (productionRates.stone / 3600) * elapsedSeconds);
                newState.resources.silver = Math.min(capacity, (prevState.resources.silver || 0) + (productionRates.silver / 3600) * elapsedSeconds);

                const templeLevel = newState.buildings.temple?.level || 0;
                if (newState.god && templeLevel > 0) {
                    let favorPerSecond = templeLevel / 3600;

                    if (playerAlliance?.research) {
                        const favorBoostLevel = playerAlliance.research.divine_devotion?.level || 0;
                        favorPerSecond *= (1 + favorBoostLevel * 0.02);
                    }

                    const maxFavor = 100 + (templeLevel * 20);
                    newState.worship[newState.god] = Math.min(maxFavor, (prevState.worship[newState.god] || 0) + favorPerSecond * elapsedSeconds);
                }
                
                newState.lastUpdated = now;
                return newState;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [activeCityId, getProductionRates, getWarehouseCapacity, playerAlliance]);

    useEffect(() => {
    const processQueue = async () => {
        try {
            const currentState = gameStateRef.current;
            
            if (!currentUser || !worldId || !activeCityId) return;
            
            if (!currentState?.buildQueue?.length && 
                !currentState?.barracksQueue?.length &&
                !currentState?.shipyardQueue?.length &&
                !currentState?.divineTempleQueue?.length &&
                !currentState?.researchQueue?.length && 
                !currentState?.healQueue?.length) {
                return;
            }

            const now = Date.now();
            let updates = {};
            let hasUpdates = false;

            const processSingleQueue = (queueName, processCompleted) => {
                if (!currentState[queueName]?.length) return;

                const activeQueue = [];
                const completedTasks = [];

                currentState[queueName].forEach(task => {
                    try {
                        const endTime = task.endTime?.toDate?.() || 
                                      (task.endTime instanceof Date ? task.endTime : new Date(task.endTime));
                        
                        if (isNaN(endTime.getTime())) {
                            console.error('Invalid endTime', task);
                            return;
                        }

                        if (now >= endTime.getTime()) {
                            completedTasks.push(task);
                        } else {
                            activeQueue.push(task);
                        }
                    } catch (error) {
                        console.error('Error processing queue item:', error);
                    }
                });

                if (completedTasks.length > 0) {
                    updates[queueName] = activeQueue;
                    processCompleted(completedTasks, updates);
                    hasUpdates = true;

                    // #comment Add notifications for completed tasks
                    completedTasks.forEach(task => {
                        let message = '';
                        let iconType = '';
                        let iconId = '';
                        const cityName = currentState.cityName;
                        switch (queueName) {
                            case 'buildQueue':
                                const building = buildingConfig[task.buildingId];
                                if (task.type === 'demolish') {
                                    message = `Demolition of ${building.name} is complete in ${cityName}.`;
                                } else {
                                    message = `Your ${building.name} (Level ${task.level}) is complete in ${cityName}.`;
                                }
                                iconType = 'building';
                                iconId = task.buildingId;
                                break;
                            case 'barracksQueue':
                            case 'shipyardQueue':
                            case 'divineTempleQueue':
                                const unit = unitConfig[task.unitId];
                                message = `Training of ${task.amount}x ${unit.name} is complete in ${cityName}.`;
                                iconType = 'unit';
                                iconId = task.unitId;
                                break;
                            case 'researchQueue':
                                const research = researchConfig[task.researchId];
                                message = `Research for ${research.name} is complete in ${cityName}.`;
                                iconType = 'building'; // Use academy icon for research
                                iconId = 'academy';
                                break;
                            case 'healQueue':
                                const healedUnit = unitConfig[task.unitId];
                                message = `Healing of ${task.amount}x ${healedUnit.name} is complete in ${cityName}.`;
                                iconType = 'unit';
                                iconId = task.unitId;
                                break;
                            default:
                                break;
                        }
                        if (message && addNotification) {
                            addNotification(message, iconType, iconId); // #comment Pass icon data
                        }
                    });
                }
            };

            processSingleQueue('buildQueue', (completed, updates) => {
                updates.buildings = updates.buildings || { ...currentState.buildings };
            
                completed.forEach(task => {
                    if (task.type === 'demolish') {
                        // #comment Handle demolition completion
                        if (updates.buildings[task.buildingId]) {
                            updates.buildings[task.buildingId].level = task.level; // task.level is currentLevel - 1
                        }
                        
                        // #comment If academy is demolished, check and deactivate now-invalid research
                        if (task.buildingId === 'academy') {
                            const newAcademyLevel = task.level;
                            updates.research = updates.research || { ...currentState.research };

                            Object.keys(updates.research).forEach(researchId => {
                                const researchState = updates.research[researchId];
                                const isCompleted = researchState === true || (researchState && researchState.completed);

                                if (isCompleted) {
                                    const researchInfo = researchConfig[researchId];
                                    if (researchInfo && researchInfo.requirements.academy > newAcademyLevel) {
                                        // Deactivate instead of deleting and refunding
                                        updates.research[researchId] = { completed: true, active: false };
                                    }
                                }
                            });
                        }
            
                    } else if (task.isSpecial) {
                        updates.specialBuilding = task.buildingId;
                    } else { // This is an upgrade completion
                        if (!updates.buildings[task.buildingId]) {
                            updates.buildings[task.buildingId] = { level: 0 };
                        }
                        updates.buildings[task.buildingId].level = task.level;

                        // #comment If academy is upgraded, check for research to reactivate
                        if (task.buildingId === 'academy') {
                            const newAcademyLevel = task.level;
                            updates.research = updates.research || { ...currentState.research };
                            
                            Object.keys(updates.research).forEach(researchId => {
                                const researchState = updates.research[researchId];
                                const isCompleted = researchState === true || (researchState && researchState.completed);
                                const isActive = researchState === true || (researchState && researchState.active);

                                if (isCompleted && !isActive) {
                                    const researchInfo = researchConfig[researchId];
                                    if (researchInfo && researchInfo.requirements.academy <= newAcademyLevel) {
                                        updates.research[researchId] = { completed: true, active: true };
                                    }
                                }
                            });
                        }
                    }
                });
            });

            processSingleQueue('barracksQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('shipyardQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('divineTempleQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('researchQueue', (completed, updates) => {
                updates.research = updates.research || { ...currentState.research };
                completed.forEach(task => {
                    // #comment Set research state to new object format
                    updates.research[task.researchId] = { completed: true, active: true };
                });
            });

            processSingleQueue('healQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            if (hasUpdates) {
                const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
                await setDoc(cityDocRef, { 
                    ...updates, 
                    lastUpdated: serverTimestamp()
                }, { merge: true });
            }
        } catch (error) {
            console.error("Error in queue processing:", error);
        }
    };

    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
}, [currentUser, worldId, activeCityId, getUpgradeCost, addNotification]);

useEffect(() => {
    const autoSave = async () => {
        if (gameStateRef.current) {
            try {
                await saveGameState(gameStateRef.current);
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        }
    };

    const saveInterval = setInterval(autoSave, 30000);
    return () => clearInterval(saveInterval);
}, [saveGameState]);

return { 
    cityGameState, 
    setCityGameState, 
    getUpgradeCost, 
    getFarmCapacity,
    getWarehouseCapacity, 
    getHospitalCapacity, 
    getProductionRates,
    calculateUsedPopulation, 
    saveGameState, 
    getResearchCost,
    calculateTotalPoints, 
    calculateHappiness,
    getHappinessDetails, 
    getMaxWorkerSlots, 
    getMarketCapacity
}
};
