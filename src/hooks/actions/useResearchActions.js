// src/hooks/actions/useResearchActions.js
import researchConfig from '../../gameData/research.json';

export const useResearchActions = ({
    cityGameState, setCityGameState, saveGameState,
    getResearchCost, setMessage
}) => {
    const handleStartResearch = async (researchId) => {
        const currentState = cityGameState;
        if (!currentState || !researchConfig[researchId]) return;

        const currentQueue = currentState.researchQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Research queue is full (max 5).");
            return;
        }

        const researchData = researchConfig[researchId];
        const { cost, requirements } = researchData;

        if (currentState.research[researchId]) {
            setMessage("Research already completed.");
            return;
        }
        if (currentQueue.some(item => item.researchId === researchId)) {
            setMessage("Research is already in the queue.");
            return;
        }
        if (requirements.academy && currentState.buildings.academy.level < requirements.academy) {
            setMessage(`Requires Academy Level ${requirements.academy}.`);
            return;
        }
        if (requirements.research && !currentState.research[requirements.research]) {
            setMessage(`Requires "${researchConfig[requirements.research].name}" research first.`);
            return;
        }
        if (
            currentState.resources.wood < cost.wood ||
            currentState.resources.stone < cost.stone ||
            currentState.resources.silver < cost.silver ||
            (currentState.researchPoints || 0) < (cost.points || 0)
        ) {
            setMessage("Not enough resources or research points.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;
        newGameState.researchPoints = (newGameState.researchPoints || 0) - (cost.points || 0);

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }
        const researchTime = getResearchCost(researchId).time;
        const endTime = new Date(lastEndTime + researchTime * 1000);

        const newQueueItem = {
            researchId,
            endTime: endTime,
        };
        newGameState.researchQueue = [...currentQueue, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
            setMessage(`Research for "${researchData.name}" started.`);
        }
        catch (error) {
            console.error("Error starting research:", error);
            setMessage("Could not start research. Please try again.");
        }
    };

    const handleCancelResearch = async (itemIndex) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.researchQueue || itemIndex < 0 || itemIndex >= currentState.researchQueue.length) {
            return;
        }

        if (itemIndex !== currentState.researchQueue.length - 1) {
            setMessage("You can only cancel the last item in the research queue.");
            return;
        }

        const newQueue = [...currentState.researchQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        const researchData = researchConfig[canceledTask.researchId];

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + researchData.cost.wood,
            stone: currentState.resources.stone + researchData.cost.stone,
            silver: currentState.resources.silver + researchData.cost.silver,
        };
        const newResearchPoints = (currentState.researchPoints || 0) + (researchData.cost.points || 0);

        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            const taskResearchTime = getResearchCost(taskToUpdate.researchId).time;
            const newEndTime = new Date(previousTaskEndTime + taskResearchTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, researchQueue: newQueue, researchPoints: newResearchPoints };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };

    return { handleStartResearch, handleCancelResearch };
};