// src/hooks/actions/useDivineActions.js

export const useDivineActions = ({
    cityGameState, setCityGameState, saveGameState,
    closeModal, setMessage
}) => {
    const handleWorshipGod = async (godName) => {
        if (!cityGameState || !godName) return;
        const newWorshipData = { ...(cityGameState.worship || {}) };
        if (newWorshipData[godName] === undefined) {
            newWorshipData[godName] = 0;
        }
        newWorshipData.lastFavorUpdate = Date.now();
        const newGameState = { ...cityGameState, god: godName, worship: newWorshipData };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        closeModal('isTempleMenuOpen');
    };

    const handleCastSpell = async (power) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.worship[currentState.god] -= power.favorCost;

        switch (power.effect.type) {
            case 'add_resources':
                newGameState.resources[power.effect.resource] = (newGameState.resources[power.effect.resource] || 0) + power.effect.amount;
                break;
            case 'add_multiple_resources':
                for (const resource in power.effect.resources) {
                    newGameState.resources[resource] = (newGameState.resources[resource] || 0) + power.effect.resources[resource];
                }
                break;
            default:
                setMessage("This spell's effect is not yet implemented.");
                return;
        }

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
            setMessage(`${power.name} has been cast!`);
            closeModal('isDivinePowersOpen');
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast the spell. Please try again.");
        }
    };

    return { handleWorshipGod, handleCastSpell };
};
