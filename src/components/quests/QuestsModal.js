// src/components/quests/QuestsModal.js
import React from 'react';
import './Quests.css';
import { getNationalUnitReward } from '../../utils/nationality';
import unitConfig from '../../gameData/units.json';

const QuestsModal = ({ quests, claimReward, isClaiming, onClose, cityState }) => {
    const activeQuests = quests.filter(q => !q.isClaimed);
    const playerNation = cityState?.playerInfo?.nation;

    // #comment A helper function to render rewards with dynamic unit names
    const renderRewards = (rewards) => {
        const rewardStrings = [];

        if (rewards.resources) {
            for (const res in rewards.resources) {
                rewardStrings.push(`${rewards.resources[res]} ${res}`);
            }
        }
        
        if (rewards.units && playerNation) {
            for (const unitId in rewards.units) {
                const count = rewards.units[unitId];
                let unitName;
                if (unitId.startsWith('generic_')) {
                    const nationalUnitId = getNationalUnitReward(playerNation, unitId);
                    unitName = unitConfig[nationalUnitId]?.name || nationalUnitId;
                } else {
                    unitName = unitConfig[unitId]?.name || unitId;
                }
                rewardStrings.push(`${count} ${unitName}`);
            }
        }

        return rewardStrings.join(', ');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="quest-modal-container" onClick={e => e.stopPropagation()}>
                <div className="quest-modal-header">
                    <h2>Quests</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="quest-modal-content">
                    {activeQuests.length > 0 ? activeQuests.map(quest => (
                        <div key={quest.id} className="quest-item">
                            <div>
                                <h3 className="quest-title">{quest.title}</h3>
                                <p className="quest-description">{quest.description}</p>
                                <div className="quest-rewards">
                                    Reward: {renderRewards(quest.rewards)}
                                </div>
                            </div>
                            <button
                                onClick={() => claimReward(quest.id)}
                                disabled={!quest.isComplete || isClaiming}
                                className="quest-claim-btn"
                            >
                                {isClaiming ? 'Claiming...' : (quest.isComplete ? 'Claim' : 'In Progress')}
                            </button>
                        </div>
                    )) : (
                        <p className="text-center">No active quests.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestsModal;
