// src/components/city/AcademyMenu.js
import React from 'react';
import researchConfig from '../../gameData/research.json';
import ResearchQueue from './ResearchQueue';
import './AcademyMenu.css'; // Import new CSS for styling

const researchImages = {};
const imageContext = require.context('../../images/research', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '').replace('.png', '');
    researchImages[key] = imageContext(item);
});

const AcademyMenu = ({ cityGameState, onResearch, onClose, researchQueue, onCancelResearch }) => {
    const { buildings, resources, research = {}, researchPoints = 0 } = cityGameState;
    const academyLevel = buildings.academy?.level || 0;

    // #comment check if player can afford research
    const canAfford = (cost) => {
        return resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver && researchPoints >= (cost.points || 0);
    };

    // #comment check if player meets research requirements
    const meetsRequirements = (reqs) => {
        if (reqs.academy && academyLevel < reqs.academy) {
            return false;
        }
        if (reqs.research && !research[reqs.research]) {
            return false;
        }
        return true;
    };

    // #comment check if research is already in queue
    const isResearchInQueue = (researchId) => {
        return (researchQueue || []).some(item => item.researchId === researchId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="academy-container" onClick={e => e.stopPropagation()}>
                <div className="academy-header">
                    <h3>Academy (Level {academyLevel})</h3>
                    <p>Research Points: {researchPoints}</p>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                
                <div className="academy-grid">
                    {Object.entries(researchConfig).map(([id, config]) => {
                        const isResearched = research[id];
                        const requirementsMet = meetsRequirements(config.requirements);
                        const affordable = canAfford(config.cost);
                        const inQueue = isResearchInQueue(id);
                        const isQueueFull = (researchQueue || []).length >= 5;

                        let reqText = '';
                        if (!requirementsMet) {
                            reqText = `Requires: Academy Lvl ${config.requirements.academy || 0}`;
                            if (config.requirements.research) {
                                reqText += ` & ${researchConfig[config.requirements.research].name}`;
                            }
                        }

                        let buttonText = 'Research';
                        let isDisabled = false;
                        if (isResearched) {
                            buttonText = 'Completed';
                            isDisabled = true;
                        } else if (inQueue) {
                            buttonText = 'In Queue';
                            isDisabled = true;
                        } else if (isQueueFull) {
                            buttonText = 'Queue Full';
                            isDisabled = true;
                        } else if (!requirementsMet) {
                            buttonText = 'Locked';
                            isDisabled = true;
                        } else if (!affordable) {
                            buttonText = 'No Resources';
                            isDisabled = true;
                        }

                        return (
                            <div key={id} className={`research-card ${isResearched ? 'researched' : ''} ${!requirementsMet ? 'locked' : ''}`}>
                                <div className="research-icon" style={{backgroundImage: `url(${researchImages[id]})`}}>
                                    <div className="research-tooltip">
                                        <h5 className="tooltip-title">{config.name}</h5>
                                        <p className="tooltip-desc">{config.description}</p>
                                        <div className="tooltip-cost">
                                            Cost: {config.cost.wood}W, {config.cost.stone}S, {config.cost.silver}Ag, {config.cost.points || 0}RP
                                        </div>
                                        {reqText && <p className="tooltip-req">{reqText}</p>}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onResearch(id)} 
                                    disabled={isDisabled} 
                                    className={`btn research-btn ${isResearched ? 'completed' : inQueue ? 'in-queue' : 'btn-primary'}`}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <ResearchQueue researchQueue={researchQueue} onCancel={onCancelResearch} />
            </div>
        </div>
    );
};

export { AcademyMenu };
