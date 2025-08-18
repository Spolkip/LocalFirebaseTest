import { v4 as uuidv4 } from 'uuid';
import buildingConfig from '../../gameData/buildings.json';

// #comment This hook provides actions related to building management in a city.
export const useBuildingActions = ({
    cityGameState, setCityGameState, saveGameState, worldId,
    getUpgradeCost, getFarmCapacity, calculateUsedPopulation, isInstantBuild,
    setMessage, closeModal
}) => {
    // #comment Handles the logic for upgrading or constructing a building.
    const handleUpgrade = async (buildingId) => {
        const currentState = cityGameState;
        if (!currentState || !worldId) return;

        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }

        const building = currentState.buildings[buildingId] || { level: 0 };
        let effectiveCurrentLevel = building.level;
        currentQueue.forEach(task => {
            if (task.buildingId === buildingId && task.type !== 'demolish' && task.level > effectiveCurrentLevel) {
                effectiveCurrentLevel = task.level;
            }
        });

        const nextLevelToQueue = effectiveCurrentLevel + 1;
        const config = buildingConfig[buildingId];
        if (config && nextLevelToQueue > config.maxLevel) {
            setMessage("Building is already at its maximum level or queued to be.");
            return;
        }

        // #comment Check all building and research requirements, including those in the queue.
        const requirements = config.requirements;
        if (requirements) {
            const unmetRequirements = [];
            for (const reqBuildingId in requirements) {
                const requiredLevel = requirements[reqBuildingId];
                
                let finalQueuedLevel = currentState.buildings[reqBuildingId]?.level || 0;
                currentQueue.forEach(task => {
                    if (task.buildingId === reqBuildingId && task.type !== 'demolish' && task.level > finalQueuedLevel) {
                        finalQueuedLevel = task.level;
                    }
                });

                if (finalQueuedLevel < requiredLevel) {
                    unmetRequirements.push(`${buildingConfig[reqBuildingId].name} Level ${requiredLevel}`);
                }
            }

            if (unmetRequirements.length > 0) {
                // #comment Join with newline characters for multi-line display in the modal.
                setMessage(`Requires:\n${unmetRequirements.join('\n')}`);
                return;
            }
        }

        const cost = getUpgradeCost(buildingId, nextLevelToQueue);
        const hasEnoughResources = currentState.resources.wood >= cost.wood &&
                                   currentState.resources.stone >= cost.stone &&
                                   currentState.resources.silver >= cost.silver;

        if (!hasEnoughResources) {
            setMessage('Not enough resources to upgrade!');
            return;
        }

        let populationInQueue = 0;
        currentQueue.forEach(task => {
            if (task.type !== 'demolish') {
                const taskCost = getUpgradeCost(task.buildingId, task.level);
                populationInQueue += taskCost.population;
            }
        });

        const currentUsedPopulation = calculateUsedPopulation(currentState);
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const newTotalPopulation = currentUsedPopulation + populationInQueue + cost.population;
        const hasEnoughPopulation = newTotalPopulation <= maxPopulation;

        if (!hasEnoughPopulation && buildingId !== 'farm' && buildingId !== 'warehouse') {
            setMessage('Not enough population capacity!');
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;

        if (buildingId === 'academy') {
            newGameState.researchPoints = (newGameState.researchPoints || 0) + 4;
        }

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }

        const endTime = new Date(lastEndTime + cost.time * 1000);

        const newQueueItem = {
            id: uuidv4(),
            buildingId,
            level: nextLevelToQueue,
            endTime: endTime,
        };
        newGameState.buildQueue = [...currentQueue, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        }
        catch (error) {
            console.error("Error adding to build queue:", error);
            setMessage("Could not start upgrade. Please try again.");
        }
    };

    const handleCancelBuild = async (itemToCancel) => {
        console.log(`[handleCancelBuild] Triggered at ${new Date().toLocaleTimeString()} for item:`, JSON.parse(JSON.stringify(itemToCancel)));
        const currentState = cityGameState;
        if (!currentState || !currentState.buildQueue) {
            return;
        }

        const itemIndex = currentState.buildQueue.findIndex(item => item.id === itemToCancel.id);
        if (itemIndex === -1) {
            console.error("Could not find item to cancel in build queue.");
            return;
        }

        if (itemIndex !== currentState.buildQueue.length - 1) {
            setMessage("You can only cancel the last item in the queue.");
            return;
        }

        const newQueue = [...currentState.buildQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        const newGameState = { ...currentState, buildQueue: newQueue };

        if (canceledTask.type !== 'demolish') {
            let cost;
            if (canceledTask.isSpecial) {
                cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
            } else {
                cost = getUpgradeCost(canceledTask.buildingId, canceledTask.level);
            }
            newGameState.resources = {
                ...currentState.resources,
                wood: currentState.resources.wood + Math.floor(cost.wood * 0.5),
                stone: currentState.resources.stone + Math.floor(cost.stone * 0.5),
                silver: currentState.resources.silver + Math.floor(cost.silver * 0.5),
            };
            if (canceledTask.buildingId === 'academy' && !canceledTask.isSpecial) {
                newGameState.researchPoints = (newGameState.researchPoints || 0) - 4;
            }
        }

        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? new Date(newQueue[i - 1].endTime).getTime() : Date.now());

            const taskToUpdate = newQueue[i];
            let taskTime;
            if (taskToUpdate.isSpecial) {
                taskTime = 7200; 
            } else if (taskToUpdate.type === 'demolish') {
                const costConfig = buildingConfig[taskToUpdate.buildingId].baseCost;
                const calculatedTime = Math.floor(costConfig.time * Math.pow(1.25, taskToUpdate.currentLevel - 1));
                taskTime = isInstantBuild ? 1 : Math.floor(calculatedTime / 2);
            }
            else {
                taskTime = getUpgradeCost(taskToUpdate.buildingId, taskToUpdate.level).time;
            }
            const newEndTime = new Date(previousTaskEndTime + taskTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };
    
    const handleDemolish = async (buildingId) => {
        const currentState = cityGameState;
        if (!currentState || !worldId) return;

        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }

        const building = currentState.buildings[buildingId];
        if (!building) {
            setMessage("Building not found.");
            return;
        }

        let finalLevel = building.level;
        const tasksForBuilding = currentQueue.filter(task => task.buildingId === buildingId);
        if (tasksForBuilding.length > 0) {
            finalLevel = tasksForBuilding[tasksForBuilding.length - 1].level;
        }

        if (finalLevel <= 0) {
            setMessage("Building is already at or being demolished to level 0.");
            return;
        }

        const levelToDemolishFrom = finalLevel;
        const targetLevel = finalLevel - 1;

        const costConfig = buildingConfig[buildingId].baseCost;
        const calculatedTime = Math.floor(costConfig.time * Math.pow(1.25, levelToDemolishFrom - 1));
        const demolitionTime = isInstantBuild ? 1 : Math.floor(calculatedTime / 2);

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }

        const endTime = new Date(lastEndTime + demolitionTime * 1000);

        const newQueueItem = {
            id: uuidv4(),
            type: 'demolish',
            buildingId,
            level: targetLevel,
            currentLevel: levelToDemolishFrom,
            endTime: endTime,
        };

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.buildQueue = [...currentQueue, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        } catch (error) {
            console.error("Error adding demolition to build queue:", error);
            setMessage("Could not start demolition. Please try again.");
        }
    };
    
    const handleBuildSpecialBuilding = async (buildingId, cost) => {
        const currentState = cityGameState;
        if (currentState.specialBuilding || (currentState.buildQueue || []).some(task => task.isSpecial)) {
            setMessage("You can only build one special building per city.");
            return;
        }

        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }

        const currentUsedPopulation = calculateUsedPopulation(currentState);
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const availablePopulation = maxPopulation - currentUsedPopulation;

        if (availablePopulation < cost.population) {
            setMessage("Not enough population to construct this wonder.");
            return;
        }

        if (
            currentState.resources.wood < cost.wood ||
            currentState.resources.stone < cost.stone ||
            currentState.resources.silver < cost.silver
        ) {
            setMessage("Not enough resources to construct this wonder.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }

        const buildTimeInSeconds = 7200;
        const endTime = new Date(lastEndTime + buildTimeInSeconds * 1000);

        const newQueueItem = {
            id: uuidv4(),
            buildingId: buildingId,
            isSpecial: true,
            level: 1, 
            endTime: endTime,
        };

        newGameState.buildQueue = [...currentQueue, newQueueItem];
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        closeModal('isSpecialBuildingMenuOpen');
        setMessage("Construction of your wonder has begun!");
    };

    const handleDemolishSpecialBuilding = async () => {
        const currentState = cityGameState;
        if (!currentState.specialBuilding) {
            setMessage("No special building to demolish.");
            return;
        }

        const cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
        const refund = {
            wood: Math.floor(cost.wood * 0.5),
            stone: Math.floor(cost.stone * 0.5),
            silver: Math.floor(cost.silver * 0.5),
        };

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood += refund.wood;
        newGameState.resources.stone += refund.stone;
        newGameState.resources.silver += refund.silver;
        delete newGameState.specialBuilding;

        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage("The wonder has been demolished and half of its resources have been returned.");
    };

    return { handleUpgrade, handleCancelBuild, handleDemolish, handleBuildSpecialBuilding, handleDemolishSpecialBuilding };
};
