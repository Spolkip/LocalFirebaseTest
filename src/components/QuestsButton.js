import React, { useMemo } from 'react';
import './QuestsButton.css';
import questSpritesheet from '../images/quests/quest_spritesheet.png';
import { useGame } from '../contexts/GameContext';

const QuestsButton = ({ quests = [], onOpenQuests }) => {
    const { gameSettings } = useGame();

    const buttonState = useMemo(() => {
        const hasUnclaimed = quests.some(q => q.isComplete && !q.isClaimed);
        const allCompleted = quests.length > 0 && quests.every(q => q.isComplete && q.isClaimed);

        if (hasUnclaimed) return 'unclaimed';
        if (allCompleted) return 'completed';
        return 'idle';
    }, [quests]);

    if (buttonState === 'completed' && gameSettings.hideCompletedQuestsIcon) {
        return null;
    }

    return (
        <div className="quests-button-container">
            <button
                onClick={onOpenQuests}
                className={`quests-button ${buttonState}`}
                title="Open Quests"
                style={{ backgroundImage: `url(${questSpritesheet})` }}
                aria-label="Quests"
            />
        </div>
    );
};

export default QuestsButton;
