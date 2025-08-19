import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction } from 'firebase/firestore';
import agentsConfig from '../../gameData/agents.json';

// #comment Handles actions related to agents like recruiting.
export const useAgentActions = (cityGameState, saveGameState, setMessage) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId } = useGame();

    // #comment Logic to recruit a new agent.
    const onRecruitAgent = async (agentId) => {
        const agent = agentsConfig[agentId];
        if (!agent) return;

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                const cityData = cityDoc.data();

                if (cityData.resources.wood < agent.cost.wood) throw new Error("Not enough wood.");
                if (cityData.resources.stone < agent.cost.stone) throw new Error("Not enough stone.");
                if (cityData.resources.silver < agent.cost.silver) throw new Error("Not enough silver.");

                const newResources = {
                    ...cityData.resources,
                    wood: cityData.resources.wood - agent.cost.wood,
                    stone: cityData.resources.stone - agent.cost.stone,
                    silver: cityData.resources.silver - agent.cost.silver
                };

                const newAgents = {
                    ...cityData.agents,
                    [agentId]: (cityData.agents?.[agentId] || 0) + 1
                };

                transaction.update(cityDocRef, { resources: newResources, agents: newAgents });
            });
            setMessage(`${agent.name} has been recruited!`);
        } catch (error) {
            setMessage(`Failed to recruit agent: ${error.message}`);
        }
    };

    // #comment Placeholder for assigning an agent.
    const onAssignAgent = async (agentId) => {
        setMessage(`${agentsConfig[agentId].name} is ready for duty.`);
    };

    return { onRecruitAgent, onAssignAgent };
};
