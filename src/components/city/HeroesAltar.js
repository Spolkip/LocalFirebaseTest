// src/components/city/HeroesAltar.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import heroesConfig from '../../gameData/heroes.json';
import './HeroesAltar.css';
import { useGame } from '../../contexts/GameContext';

const heroImages = {};
const heroImageContext = require.context('../../images/heroes', false, /\.(png|jpe?g|svg)$/);
heroImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    heroImages[key] = heroImageContext(item);
});

const skillImages = {};
const skillImageContext = require.context('../../images/skills', false, /\.(png|jpe?g|svg)$/);
skillImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    skillImages[key] = skillImageContext(item);
});

const HeroesAltar = ({ cityGameState, onRecruitHero, onActivateSkill, onClose, onAssignHero, onUnassignHero, onLevelUpHero, onAddHeroXp }) => {
    const [selectedHeroId, setSelectedHeroId] = useState(Object.keys(heroesConfig)[0]);
    const { heroes = {}, activeSkills = {} } = cityGameState;
    const { activeCityId } = useGame();

    const altarRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 800) / 2,
        y: (window.innerHeight - 700) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('heroes-altar-header') || e.target.parentElement.classList.contains('heroes-altar-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);
    
    // #comment Handles recruiting a hero, stopping the event from bubbling up.
    const handleRecruit = (e, heroId) => {
        e.stopPropagation();
        onRecruitHero(heroId);
    };

    // #comment Handles activating a hero's skill, stopping the event from bubbling up.
    const handleSkillActivation = (e, heroId, skill) => {
        e.stopPropagation();
        onActivateSkill(heroId, skill);
    };

    const handleAssign = (e, heroId) => {
        e.stopPropagation();
        onAssignHero(heroId);
    };

    const handleUnassign = (e, heroId) => {
        e.stopPropagation();
        onUnassignHero(heroId);
    };

    const selectedHero = heroesConfig[selectedHeroId];
    const heroData = heroes[selectedHeroId] || { level: 1, xp: 0 };
    const isHeroInThisCity = heroData?.cityId === activeCityId;

    // #comment Helper functions for dynamic values based on hero level
    const getEffectValue = (effect, level) => {
        if (!effect || typeof level !== 'number') return 0;
        return (effect.baseValue || 0) + ((level - 1) * (effect.valuePerLevel || 0));
    };

    const getSkillCost = (skill, level) => {
        if (!skill || !skill.cost || !skill.cost.favor || typeof level !== 'number') return 0;
        const favorCost = skill.cost.favor;
        return (favorCost.base || 0) + ((level - 1) * (favorCost.perLevel || 0));
    };
    
    // #comment Formats description strings to correctly display dynamic values.
    const formatDescription = (description, effect, level) => {
        if (!description || !effect || typeof level !== 'number') return description || '';
        const currentValue = getEffectValue(effect, level) * 100;
        const perLevelValue = (effect.valuePerLevel || 0) * 100;
    
        let formatted = description.replace(/(\d+(\.\d+)?%)/, `${currentValue.toFixed(1)}%`);
        if (perLevelValue > 0) {
             formatted += ` (+${perLevelValue.toFixed(1)}% per level)`;
        }
    
        return formatted;
    };

    const xpForNextLevel = heroData.level < selectedHero.maxLevel ? selectedHero.xpPerLevel[heroData.level - 1] : Infinity;
    const canLevelUp = heroData.xp >= xpForNextLevel && heroData.level < selectedHero.maxLevel;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div
                ref={altarRef}
                className="heroes-altar-container"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="heroes-altar-header">
                    <h3>Heroes Altar</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="heroes-altar-content">
                    <div className="heroes-list">
                        {Object.entries(heroesConfig).map(([id, hero]) => (
                            <div key={id} className={`hero-list-item ${selectedHeroId === id ? 'selected' : ''}`} onClick={() => setSelectedHeroId(id)}>
                                <img src={heroImages[hero.image]} alt={hero.name} className="hero-list-avatar" />
                                <span>{hero.name}</span>
                                {heroes[id] && <span className="recruited-indicator">✔</span>}
                            </div>
                        ))}
                    </div>
                    <div className="hero-details-panel">
                        {selectedHero ? (
                            <div className="hero-details-content">
                                <div className="hero-main-info">
                                    <img src={heroImages[selectedHero.image]} alt={selectedHero.name} className="hero-details-avatar" />
                                    <div className="hero-text">
                                        <h4>{selectedHero.name} {heroes[selectedHeroId] && `(Lvl ${heroData.level})`}</h4>
                                        <p>{selectedHero.description}</p>
                                        {selectedHero.passive && (
                                            <div className="passive-skill-info">
                                                <h5>Passive: {selectedHero.passive.name}</h5>
                                                <p>{formatDescription(selectedHero.passive.description, selectedHero.passive.effect, heroData.level)}</p>
                                            </div>
                                        )}
                                        
                                        {/* XP Bar and Level Up */}
                                        {heroes[selectedHeroId] && (
                                            <div className="mt-2">
                                                <div className="w-full bg-gray-600 rounded-full h-4">
                                                    <div className="bg-yellow-400 h-4 rounded-full" style={{ width: `${Math.min(100, (heroData.xp / (xpForNextLevel === Infinity ? heroData.xp : xpForNextLevel)) * 100)}%` }}></div>
                                                </div>
                                                <p className="text-xs text-center">{heroData.xp} / {xpForNextLevel === Infinity ? 'Max' : xpForNextLevel} XP</p>
                                                {canLevelUp && (
                                                    <button className="recruit-btn mt-1" onClick={() => onLevelUpHero(selectedHeroId)}>
                                                        Level Up ({selectedHero.levelUpCost.silver} Silver, {selectedHero.levelUpCost.favor} Favor)
                                                    </button>
                                                )}
                                                {/* Temp button for testing */}
                                                <button className="text-xs" onClick={() => onAddHeroXp(selectedHeroId, 100)}>+100 XP</button>
                                            </div>
                                        )}
                                        
                                        {/* Action Buttons */}
                                        {!heroes[selectedHeroId] && (
                                            <button className="recruit-btn" onClick={(e) => handleRecruit(e, selectedHeroId)}>
                                                Recruit ({selectedHero.cost.silver} Silver, {selectedHero.cost.favor} Favor)
                                            </button>
                                        )}
                                        {heroes[selectedHeroId] && !isHeroInThisCity && (
                                            <button className="recruit-btn" onClick={(e) => handleAssign(e, selectedHeroId)}>
                                                Assign to this City
                                            </button>
                                        )}
                                        {heroes[selectedHeroId] && isHeroInThisCity && (
                                            <button className="recruit-btn" onClick={(e) => handleUnassign(e, selectedHeroId)}>
                                                Unassign from City
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="skills-list">
                                    {selectedHero.skills.map(skill => {
                                        const currentSkillCost = getSkillCost(skill, heroData.level);
                                        const skillCooldown = activeSkills[skill.name];
                                        const isOnCooldown = skillCooldown && Date.now() < skillCooldown.expires;
                                        const timeLeft = isOnCooldown ? Math.ceil((skillCooldown.expires - Date.now()) / 1000) : 0;

                                        return (
                                            <div key={skill.name} className="skill-card">
                                                <img src={skillImages[skill.icon]} alt={skill.name} className="skill-icon" />
                                                <div className="skill-info">
                                                    <h5>{skill.name} <span className="skill-type">({skill.type})</span></h5>
                                                    <p>{formatDescription(skill.description, skill.effect, heroData.level)}</p>
                                                </div>
                                                {heroes[selectedHeroId] && (
                                                    <button 
                                                        className="activate-skill-btn" 
                                                        onClick={(e) => handleSkillActivation(e, selectedHeroId, skill)}
                                                        disabled={isOnCooldown}
                                                    >
                                                        {isOnCooldown ? `Cooldown: ${timeLeft}s` : `Activate (${currentSkillCost} Favor)`}
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <p>Select a hero to see details.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeroesAltar;
