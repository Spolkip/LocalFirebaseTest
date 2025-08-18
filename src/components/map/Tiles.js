import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import godTownImage from '../../images/god-town.png';
import unitConfig from '../../gameData/units.json';
import allianceWonders from '../../gameData/alliance_wonders.json';
const images = {};
const imageContexts = [
    require.context('../../images', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/troops', false, /\.(png|jpe?g|svg)$/),
];
imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        // To prevent overwrites if filenames are the same in different folders, check if key exists.
        if (!images[key]) {
            images[key] = context(item);
        }
    });
});
const defaultSettings = { showVisuals: true, showGrid: true };
const _WaterTile = ({ gameSettings = defaultSettings }) => {
    return <div className="w-full h-full bg-transparent" />;
};
const _LandTile = ({ gameSettings = defaultSettings }) => {
    // #comment Make land tiles transparent so the island images in MapView are visible.
    const bgClass = gameSettings.showVisuals ? 'bg-transparent' : 'bg-gray-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700/20' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';
    return <div className={`w-full h-full ${bgClass} ${borderClass}`} />;
};
const _CitySlotTile = ({ slotData, onClick, isPlacingDummyCity, playerAlliance, gameSettings = defaultSettings, cityPoints, scoutedCities, islandCenterX }) => {
    const { currentUser } = useAuth();
    let slotClass = 'empty-slot';
    let tooltipText = `Empty Plot (${slotData.x}, ${slotData.y})`;
    let citySpriteStyle = {};
    let hasCitySprite = false;
    const formatUnitsForTooltip = (units) => {
        if (!units || Object.keys(units).length === 0) return '';
        const unitEntries = Object.entries(units)
            .filter(([, count]) => count > 0)
            .map(([id, count]) => {
                const unit = unitConfig[id];
                if (!unit) return '';
                const imageUrl = images[unit.image];
                return `
                    <div class="tooltip-troop-item">
                        <img src="${imageUrl}" alt="${unit.name}" class="tooltip-troop-image" />
                        <span class="tooltip-troop-count">${count}</span>
                    </div>
                `;
            })
            .join('');
        if (!unitEntries) return '';
        return `<hr class="tooltip-hr"><b>City Units</b><br><div class="tooltip-troop-grid">${unitEntries}</div>`;
    };
    if (slotData.ownerId) {
        hasCitySprite = true;
        const ownerName = slotData.ownerUsername || 'Unknown';
        const isOwn = slotData.ownerId === currentUser.uid;

        // #comment Use playerAlliance context for consistent alliance info for own cities
        const cityAllianceTag = isOwn ? playerAlliance?.tag : slotData.alliance;
        const cityAllianceName = isOwn ? playerAlliance?.name : slotData.allianceName;
        
        // #comment Use the correct key to find city points for own cities vs other players' cities
        const pointsKey = isOwn ? slotData.slotId : slotData.id;
        const points = cityPoints[pointsKey] || 0;

        let troopsHTML = '';
        if (isOwn) {
            slotClass = 'my-city';
            troopsHTML = formatUnitsForTooltip(slotData.units);
        } else if (slotData.ownerId === 'ghost') {
            slotClass = 'ghost-city';
            hasCitySprite = false;
            troopsHTML = formatUnitsForTooltip(slotData.units);
        } else if (scoutedCities && scoutedCities[slotData.id]) {
            troopsHTML = formatUnitsForTooltip(scoutedCities[slotData.id]);
        }
        const baseInfo = `
            <div class="tooltip-info-section">
                <b>${slotData.cityName}</b><br>
                Owner: ${ownerName}<br>
                Points: ${points.toLocaleString()}<br>
                Alliance: ${cityAllianceName || 'None'}
            </div>
        `;
        tooltipText = `${baseInfo}${troopsHTML}`;
        if (slotData.ownerId !== currentUser.uid && slotData.ownerId !== 'ghost') {
            if (playerAlliance && playerAlliance.tag && cityAllianceTag) {
                const allies = playerAlliance.diplomacy?.allies || [];
                const enemies = playerAlliance.diplomacy?.enemies || [];
                if (cityAllianceTag.toUpperCase() === playerAlliance.tag.toUpperCase()) {
                    slotClass = 'alliance-city';
                } else if (allies.some(ally => ally && ally.tag && ally.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                    slotClass = 'ally-city';
                } else if (enemies.some(enemy => enemy && enemy.tag && enemy.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                    slotClass = 'enemy-city';
                } else {
                    slotClass = 'neutral-city';
                }
            } else if (slotData.ownerId.startsWith('dummy_')) {
                slotClass = 'dummy-city-plot';
                 hasCitySprite = false;
            } else {
                slotClass = 'neutral-city';
            }
        }
        if (gameSettings.showVisuals && hasCitySprite) {
            const isLeftSide = slotData.x < islandCenterX;
            const backgroundPositionX = isLeftSide ? '0%' : '100%';
            let backgroundPositionY;
            if (points < 2000) {
                backgroundPositionY = '0%';
            } else if (points <= 10000) {
                backgroundPositionY = '50%';
            } else {
                backgroundPositionY = '100%';
            }
            citySpriteStyle = {
                backgroundImage: `url(${images['city_modal.png']})`,
                backgroundSize: '200% 300%',
                backgroundPosition: `${backgroundPositionX} ${backgroundPositionY}`,
            };
        }
    } else if (isPlacingDummyCity) {
        slotClass = 'dummy-placement-plot';
        tooltipText = 'Click to place dummy city';
    }
    const backgroundClass = 'bg-transparent';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700/20' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';
    return (
        <div className={`w-full h-full ${backgroundClass} ${borderClass} flex justify-center items-center`}>
            <div onClick={(e) => onClick(e, slotData)} className={`city-slot ${slotClass}`}>
                 {gameSettings.showVisuals && hasCitySprite && <div className="city-sprite" style={citySpriteStyle}></div>}
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};
const _FarmingVillageTile = ({ villageData, onClick, conqueredVillages, gameSettings = defaultSettings }) => {
    const level = villageData.level || 1;
    let villageClass = `village-level-${level}`;
    let tooltipText = `Village: ${villageData.name}<br>Level: ${level}`;
    const conqueredData = conqueredVillages ? conqueredVillages[villageData.id] : null;
    if (conqueredData) {
        villageClass += ' my-village';
        const happiness = conqueredData.happiness !== undefined ? conqueredData.happiness : 100;
        tooltipText = `Your Village: ${villageData.name}<br>Happiness: ${Math.floor(happiness)}%`;
    } else {
        villageClass += ' other-village-plot';
    }
    const backgroundClass = 'bg-transparent';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700/20' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';
    return (
        <div className={`w-full h-full ${backgroundClass} ${borderClass} flex justify-center items-center`}>
            <div onClick={(e) => onClick(e, villageData)} className={`village-slot ${villageClass}`}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};
const _RuinTile = ({ ruinData, onClick, gameSettings = defaultSettings }) => {
    let ruinClass = 'ruin-slot';
    let tooltipText = `Ruin: ${ruinData.name}`;
    if (ruinData.ownerId && ruinData.ownerId !== 'ruins') {
        ruinClass += ' ruin-occupied';
        tooltipText = `Conquered Ruin<br>Owner: ${ruinData.ownerUsername}`;
    } else {
        ruinClass += ' ruin-unoccupied';
    }
    const bgClass = 'bg-transparent';
    return (
        <div className={`w-full h-full ${bgClass} flex justify-center items-center`}>
            <div
                onClick={(e) => onClick(e, ruinData)}
                className={ruinClass}
            >
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};
const _GodTownTile = ({ townData, onClick, gameSettings = defaultSettings }) => {
    let townClass = 'god-town-slot';
    let tooltipText = `God Town: ${townData.name}`;
    let image = townData.stage === 'ruins' ? images['ruin_new.png'] : godTownImage;
    if (townData.stage === 'ruins') {
        townClass += ' ruins';
        tooltipText = `Strange Ruins`;
    } else if (townData.stage === 'city') {
        townClass += ' city';
        tooltipText = `God Town: ${townData.name}<br>Health: ${townData.health}`;
    }
    const bgClass = 'bg-transparent';
    return (
        <div className={`w-full h-full ${bgClass} flex justify-center items-center`}>
            <div
                onClick={() => onClick(townData.id)}
                className={townClass}
                style={{ backgroundImage: `url(${image})` }}
            >
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};
const _WonderSpotTile = ({ spotData, onClick, playerAlliance, controlledIslands }) => {
    const allianceTag = playerAlliance?.tag;
    const controllingAllianceTag = controlledIslands ? controlledIslands[spotData.islandId] : null;
    const hasControl = allianceTag && allianceTag === controllingAllianceTag;
    const tileClass = `wonder-spot-tile ${hasControl ? 'active' : ''}`;
    const tooltipText = hasControl
        ? "Click to build an Alliance Wonder"
        : "Your alliance must control this entire island to build a wonder.";
    const handleClick = hasControl ? () => onClick(spotData) : undefined;
    return (
        <div className="w-full h-full flex justify-center items-center">
            <div onClick={handleClick} className={tileClass}>
                <span className="map-object-tooltip">{tooltipText}</span>
            </div>
        </div>
    );
};
const _ConstructingWonderTile = ({ wonderData, onClick }) => {
    const wonderConfig = allianceWonders[wonderData.id];
    const tooltipText = `${wonderConfig.name} (Lvl ${wonderData.level})<br>Alliance: ${wonderData.allianceName || 'Unknown'}`;
    return (
        <div className="w-full h-full flex justify-center items-center">
            <div onClick={() => onClick(wonderData)} className="constructing-wonder-tile">
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};
export const WaterTile = React.memo(_WaterTile);
export const LandTile = React.memo(_LandTile);
export const CitySlotTile = React.memo(_CitySlotTile);
export const FarmingVillageTile = React.memo(_FarmingVillageTile);
export const RuinTile = React.memo(_RuinTile);
export const GodTownTile = React.memo(_GodTownTile);
export const WonderSpotTile = React.memo(_WonderSpotTile);
export const ConstructingWonderTile = React.memo(_ConstructingWonderTile);
