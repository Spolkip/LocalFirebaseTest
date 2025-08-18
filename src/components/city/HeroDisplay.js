// src/components/city/HeroDisplay.js
import React from 'react';
import heroesConfig from '../../gameData/heroes.json';
import './HeroDisplay.css';

const heroImages = {};
const imageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = imageContext(item);
});


const HeroDisplay = ({ heroes }) => {
    const recruitedHeroes = Object.keys(heroes || {}).filter(heroId => heroes[heroId].active);

    if (recruitedHeroes.length === 0) {
        return null;
    }

    return (
        <div className="hero-display-container">
            <h3 className="hero-display-header">Hero</h3>
            <div className="heroes-grid">
                {recruitedHeroes.map(heroId => {
                    const hero = heroesConfig[heroId];
                    return (
                        <div key={heroId} className="hero-item" title={hero.name}>
                            <img src={heroImages[hero.image]} alt={hero.name} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroDisplay;
