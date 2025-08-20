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
    const recruitedHeroes = Object.keys(heroes || {}).filter(heroId => heroes[heroId].active && heroes[heroId].cityId === activeCityId);
    const recruitedAgents = Object.keys(agents || {}).filter(agentId => agents[agentId] > 0);
    const travelingHeroes = movements
        .filter(m => m.type === 'assign_hero' && m.targetCityId === activeCityId)
        .map(m => m.hero);

    if (recruitedHeroes.length === 0 && recruitedAgents.length === 0 && travelingHeroes.length === 0) {
        return null;
    }

    return (
        <div className="hero-display-container">
            <h3 className="hero-display-header">Heroes & Agents</h3>
            <div className="heroes-grid">
                {recruitedHeroes.map(heroId => {
                    const hero = heroesConfig[heroId];
                    return (
                        <div key={heroId} className="hero-item" title={hero.name}>
                            <img src={heroImages[hero.image]} alt={hero.name} />
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
                {travelingHeroes.map(heroId => {
                    const hero = heroesConfig[heroId];
                    return (
                        <div key={`traveling-${heroId}`} className="hero-item" title={`${hero.name} (Traveling)`}>
                            <img src={heroImages[hero.image]} alt={hero.name} style={{ opacity: 0.5 }} />
                            <span className="absolute inset-0 flex items-center justify-center text-white font-bold">✈️</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroDisplay;
