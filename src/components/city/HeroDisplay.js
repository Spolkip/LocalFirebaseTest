import React from 'react';
import heroesConfig from '../../gameData/heroes.json';
import agentsConfig from '../../gameData/agents.json';
import './HeroDisplay.css';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

const agentImages = {};
const agentImageContext = require.context('../../images/agents', false, /\.(png|jpe?g|svg)$/);
agentImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    agentImages[key] = agentImageContext(item);
});

const HeroDisplay = ({ heroes, agents, movements, activeCityId }) => {
    // #comment Show all active heroes that are assigned to a city, captured, or currently in a movement.
    const heroesToShow = Object.keys(heroes || {}).filter(heroId => {
        const hero = heroes[heroId];
        const isTraveling = (movements || []).some(m => m.hero === heroId);
        return hero.active && (hero.cityId || hero.capturedIn || isTraveling);
    });
    const recruitedAgents = Object.keys(agents || {}).filter(agentId => agents[agentId] > 0);

    if (heroesToShow.length === 0 && recruitedAgents.length === 0) {
        return null;
    }

    return (
        <div className="hero-display-container">
            <h3 className="hero-display-header">Heroes & Agents</h3>
            <div className="heroes-grid">
                {heroesToShow.map(heroId => {
                    const hero = heroesConfig[heroId];
                    const heroData = heroes[heroId];
                    const isCaptured = !!heroData?.capturedIn;
                    const heroMovement = (movements || []).find(m => m.hero === heroId);
                    // #comment A hero is away if assigned to a different city, not captured, and not currently traveling.
                    const isAway = heroData?.cityId && heroData.cityId !== activeCityId && !isCaptured && !heroMovement;

                    let statusTitle = hero.name;
                    let overlay = null;
                    let customClass = '';

                    if (isCaptured) {
                        statusTitle = `${hero.name} (Captured)`;
                        overlay = <div className="captured-bars-overlay"></div>;
                        customClass = 'opacity-50';
                    } else if (heroMovement) {
                        statusTitle = `${hero.name} (Traveling)`;
                        overlay = <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">✈️</span>;
                        customClass = 'opacity-50';
                    } else if (isAway) {
                        statusTitle = `${hero.name} (Away)`;
                        customClass = 'opacity-50 grayscale'; // #comment Visual indicator for away status
                    }

                    return (
                        <div key={heroId} className="hero-item relative" title={statusTitle}>
                            <img src={heroImages[hero.image]} alt={hero.name} className={customClass} />
                            {overlay}
                        </div>
                    );
                })}
                {recruitedAgents.map(agentId => {
                    const agent = agentsConfig[agentId];
                    const agentCount = agents[agentId];
                    return (
                        <div key={agentId} className="hero-item" title={`${agent.name} (x${agentCount})`}>
                            <img src={agentImages[agent.image]} alt={agent.name} />
                            <span className="troop-count">{agentCount}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroDisplay;
