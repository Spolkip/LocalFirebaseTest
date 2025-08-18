// src/hooks/actions/useUnitActions.js
import { v4 as uuidv4 } from 'uuid';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/config';
import unitConfig from '../../gameData/units.json';

// #comment get warehouse capacity based on its level
const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

export const useUnitActions = ({
    cityGameState, setCityGameState, saveGameState, worldId, currentUser,
    getFarmCapacity, calculateUsedPopulation, isInstantUnits,
    setMessage
}) => {
    const handleTrainTroops = async (unitId, amount) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || amount <= 0) return;

        const unit = unitConfig[unitId];
        if (!unit) {
            setMessage("Invalid unit type");
            return;
        }

        let queueName;
        let requiredBuildingLevel = 0;
        
        if (unit.type === 'naval') {
            queueName = 'shipyardQueue';
            requiredBuildingLevel = currentState.buildings.shipyard?.level || 0;
            if (requiredBuildingLevel === 0) {
                setMessage("Naval units can only be built in the Shipyard.");
                return;
            }
        } else if (unit.mythical) {
            queueName = 'divineTempleQueue';
            requiredBuildingLevel = currentState.buildings.divine_temple?.level || 0;
            if (requiredBuildingLevel === 0) {
                setMessage("Mythical units can only be trained in the Divine Temple.");
                return;
            }
        } else if (unit.type === 'land') {
            queueName = 'barracksQueue';
            requiredBuildingLevel = currentState.buildings.barracks?.level || 0;
            if (requiredBuildingLevel === 0) {
                setMessage("Land units can only be trained in the Barracks.");
                return;
            }
        } else {
            setMessage("Unknown unit type.");
            return;
        }

        const currentQueue = currentState[queueName] || [];
        if (currentQueue.length >= 5) {
            setMessage("Unit training queue is full (max 5).");
            return;
        }

        const totalCost = {
            wood: unit.cost.wood * amount,
            stone: unit.cost.stone * amount,
            silver: unit.cost.silver * amount,
            population: unit.cost.population * amount,
            favor: unit.cost.favor ? unit.cost.favor * amount : 0,
        };

        const effectiveUsedPopulation = calculateUsedPopulation(currentState);

        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const availablePopulation = maxPopulation - effectiveUsedPopulation;

        if (currentState.resources.wood < totalCost.wood) {
            setMessage(`Need ${totalCost.wood - currentState.resources.wood} more wood`);
            return;
        }
        if (currentState.resources.stone < totalCost.stone) {
            setMessage(`Need ${totalCost.stone - currentState.resources.stone} more stone`);
            return;
        }
        if (currentState.resources.silver < totalCost.silver) {
            setMessage(`Need ${totalCost.silver - currentState.resources.silver} more silver`);
            return;
        }
        if (availablePopulation < totalCost.population) {
            setMessage(`Need ${totalCost.population - availablePopulation} more population capacity`);
            return;
        }
        if (unit.mythical && currentState.worship[currentState.god] < totalCost.favor) {
            setMessage(`Need ${totalCost.favor - currentState.worship[currentState.god]} more favor for ${currentState.god}`);
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= totalCost.wood;
        newGameState.resources.stone -= totalCost.stone;
        newGameState.resources.silver -= totalCost.silver;
        if (unit.mythical) {
            newGameState.worship[newGameState.god] -= totalCost.favor;
        }

        const activeQueueForType = currentQueue.filter(task => {
            const taskEndTime = task.endTime?.toDate ? task.endTime.toDate() : new Date(task.endTime);
            return taskEndTime.getTime() > Date.now();
        });

        let lastEndTime = Date.now();
        if (activeQueueForType.length > 0) {
            const lastItem = activeQueueForType[activeQueueForType.length - 1];
            const lastItemEndTime = lastItem.endTime?.toDate ? lastItem.endTime.toDate() : new Date(lastItem.endTime);
            lastEndTime = lastItemEndTime.getTime();
        }

        const trainingTime = isInstantUnits ? 1 : unit.cost.time * amount;
        const endTime = new Date(lastEndTime + trainingTime * 1000);

        const newQueueItem = {
            id: uuidv4(),
            unitId,
            amount,
            endTime: endTime,
        };
        newGameState[queueName] = [...activeQueueForType, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        } catch (error) {
            console.error("Error adding to unit queue:", error);
            setMessage("Could not start training. Please try again.");
        }
    };

    const handleCancelTrain = async (canceledItem, queueType) => {
        const currentState = cityGameState;
        let queueName;
        let costField;
        let refundField;
    
        switch (queueType) {
            case 'barracks':
            case 'shipyard':
            case 'divineTemple':
                queueName = `${queueType}Queue`;
                costField = 'cost';
                refundField = 'units';
                break;
            case 'heal':
                queueName = 'healQueue';
                costField = 'heal_cost';
                refundField = 'wounded';
                break;
            default:
                console.error("Invalid queueType for cancellation:", queueType);
                setMessage("Error: Invalid queue type for cancellation.");
                return;
        }
    
        if (!currentState || !currentState[queueName]) {
            return;
        }
    
        const currentQueue = [...currentState[queueName]];
        const itemIndex = currentQueue.findIndex((item) => item.id === canceledItem.id);
    
        if (itemIndex === -1) {
            console.error("Item not found in queue for cancellation:", canceledItem);
            setMessage("Error: Item not found in queue.");
            return;
        }

        if (itemIndex !== currentQueue.length - 1) {
            setMessage("You can only cancel the last item in the queue.");
            return;
        }
    
        const newQueue = [...currentQueue];
        const removedTask = newQueue.splice(itemIndex, 1)[0];
        const unit = unitConfig[removedTask.unitId];
    
        if (!unit) {
            console.error("Unit not found for canceled task:", removedTask.unitId);
            setMessage("Error: Unit data missing for canceled task.");
            return;
        }
    
        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', currentState.id);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                const liveCityData = cityDoc.data();
                const capacity = getWarehouseCapacity(liveCityData.buildings.warehouse?.level);
                
                const newResources = {
                    ...liveCityData.resources,
                    wood: Math.min(capacity, (liveCityData.resources.wood || 0) + (unit[costField]?.wood || 0) * removedTask.amount),
                    stone: Math.min(capacity, (liveCityData.resources.stone || 0) + (unit[costField]?.stone || 0) * removedTask.amount),
                    silver: Math.min(capacity, (liveCityData.resources.silver || 0) + (unit[costField]?.silver || 0) * removedTask.amount),
                };
        
                const newRefundUnits = { ...liveCityData[refundField] };
                if (queueType === 'heal') {
                    newRefundUnits[removedTask.unitId] = (newRefundUnits[removedTask.unitId] || 0) + removedTask.amount;
                }
        
                for (let i = itemIndex; i < newQueue.length; i++) {
                    const previousTaskEndTime = (i === 0)
                        ? Date.now()
                        : (newQueue[i - 1]?.endTime ? new Date(newQueue[i - 1].endTime).getTime() : Date.now());
                    
                    const taskToUpdate = newQueue[i];
                    const taskUnit = unitConfig[taskToUpdate.unitId];
                    const taskTime = (queueType === 'heal' ? taskUnit.heal_time : taskUnit.cost.time) * taskToUpdate.amount;
                    const newEndTime = new Date(previousTaskEndTime + taskTime * 1000);
                    newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
                }
        
                const updates = { resources: newResources, [queueName]: newQueue };
                if (queueType === 'heal') {
                    updates[refundField] = newRefundUnits;
                }
                
                transaction.update(cityDocRef, updates);
            });
        } catch (error) {
            console.error("Error cancelling training/healing:", error);
            setMessage("Could not cancel. Please try again.");
        }
    };

    const handleHealTroops = async (unitsToHeal) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || Object.keys(unitsToHeal).length === 0) return;
    
        const newGameState = JSON.parse(JSON.stringify(currentState));
        let currentQueue = newGameState.healQueue || [];
        
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const usedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
        const availablePopulation = maxPopulation - usedPopulation;
        let populationToHeal = 0;
        for (const unitId in unitsToHeal) {
            const amount = unitsToHeal[unitId];
            const unit = unitConfig[unitId];
            populationToHeal += (unit.cost.population || 0) * amount;
        }
        if (availablePopulation < populationToHeal) {
            setMessage("Not enough available population to heal these units.");
            return;
        }
    
        const tasksToAdd = [];
        const totalCost = { wood: 0, stone: 0, silver: 0 };
    
        for (const unitId in unitsToHeal) {
            const amount = unitsToHeal[unitId];
            if (amount > 0) {
                const unit = unitConfig[unitId];
                tasksToAdd.push({
                    unitId,
                    amount,
                    cost: {
                        wood: (unit.heal_cost.wood || 0) * amount,
                        stone: (unit.heal_cost.stone || 0) * amount,
                        silver: (unit.heal_cost.silver || 0) * amount,
                    },
                    time: (unit.heal_time || 0) * amount,
                });
                totalCost.wood += tasksToAdd[tasksToAdd.length - 1].cost.wood;
                totalCost.stone += tasksToAdd[tasksToAdd.length - 1].cost.stone;
                totalCost.silver += tasksToAdd[tasksToAdd.length - 1].cost.silver;
            }
        }
    
        if (tasksToAdd.length + currentQueue.length > 5) {
            setMessage("Not enough space in the healing queue.");
            return;
        }
    
        if (
            currentState.resources.wood >= totalCost.wood &&
            currentState.resources.stone >= totalCost.stone &&
            currentState.resources.silver >= totalCost.silver
        ) {
            newGameState.resources.wood -= totalCost.wood;
            newGameState.resources.stone -= totalCost.stone;
            newGameState.resources.silver -= totalCost.silver;
    
            const newWounded = { ...newGameState.wounded };
            for (const task of tasksToAdd) {
                newWounded[task.unitId] -= task.amount;
                if (newWounded[task.unitId] <= 0) {
                    delete newWounded[task.unitId];
                }
            }
            newGameState.wounded = newWounded;
    
            let lastEndTime = Date.now();
            if (currentQueue.length > 0) {
                const lastQueueItem = currentQueue[currentQueue.length - 1];
                lastEndTime = lastQueueItem.endTime.toDate ? lastQueueItem.endTime.toDate().getTime() : new Date(lastQueueItem.endTime).getTime();
            }
    
            for (const task of tasksToAdd) {
                const endTime = new Date(lastEndTime + task.time * 1000);
                const newQueueItem = {
                    id: uuidv4(),
                    unitId: task.unitId,
                    amount: task.amount,
                    endTime,
                };
                currentQueue.push(newQueueItem);
                lastEndTime = endTime.getTime();
            }
            newGameState.healQueue = currentQueue;
    
            try {
                await saveGameState(newGameState);
                setCityGameState(newGameState);
                setMessage(`Healing started.`);
            } catch (error) {
                console.error("Error starting healing:", error);
                setMessage("Could not start healing. Please try again.");
            }
        } else {
            setMessage("Not enough resources to heal troops!");
        }
    };

    const handleCancelHeal = async (item) => {
        await handleCancelTrain(item, 'heal');
    };

    const handleFireTroops = async (unitsToFire) => {
        if (!cityGameState || !worldId || Object.keys(unitsToFire).length === 0) return;

        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', cityGameState.id);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) {
                    throw new Error("City document not found!");
                }
                const currentState = cityDoc.data();
                const newUnits = { ...currentState.units };

                for (const unitId in unitsToFire) {
                    const amount = unitsToFire[unitId];
                    if (newUnits[unitId] && newUnits[unitId] >= amount) {
                        newUnits[unitId] -= amount;
                        if (newUnits[unitId] === 0) {
                            delete newUnits[unitId];
                        }
                    } else {
                        throw new Error(`Trying to dismiss more ${unitId} than available.`);
                    }
                }
                transaction.update(cityDocRef, { units: newUnits });
            });
            setMessage("Units dismissed.");
        } catch (error) {
            console.error("Error firing units:", error);
            setMessage(`Could not dismiss units: ${error.message}`);
        }
    };

    return { handleTrainTroops, handleCancelTrain, handleHealTroops, handleCancelHeal, handleFireTroops };
};
