// src/components/map/MapGrid.js
import React, { useMemo } from 'react';
import { WaterTile, LandTile, CitySlotTile, FarmingVillageTile, RuinTile, GodTownTile, WonderSpotTile, ConstructingWonderTile } from './Tiles';
import MovementIndicator from './MovementIndicator';
import { useGame } from '../../contexts/GameContext';

const TILE_SIZE = 32;
const defaultSettings = { animations: true, showVisuals: true, showGrid: true };

const MapGrid = ({ mapGrid, worldState, pan, zoom, viewportSize, onCitySlotClick, onVillageClick, onRuinClick, onGodTownClick, onWonderSpotClick, onConstructingWonderClick, isPlacingDummyCity, movements, combinedSlots, villages, ruins, godTowns, playerAlliance, conqueredVillages, gameSettings = defaultSettings, cityPoints, scoutedCities, controlledIslands }) => {
    const { playerCities } = useGame();

    const locationLookup = useMemo(() => {
        const lookup = {};
        Object.values({...combinedSlots, ...villages, ...ruins, ...godTowns}).forEach(loc => {
            if (loc && loc.id) lookup[loc.id] = loc;
        });
        Object.values(playerCities || {}).forEach(city => {
            if (city && city.id) lookup[city.id] = city;
        });
        return lookup;
    }, [combinedSlots, villages, ruins, godTowns, playerCities]);

    if (!mapGrid || !worldState?.islands || viewportSize.width === 0) return null;

    const scaledTileSize = TILE_SIZE * zoom;
    const startCol = Math.max(0, Math.floor(-pan.x / scaledTileSize));
    const endCol = Math.min(worldState.width, Math.ceil((-pan.x + viewportSize.width) / scaledTileSize));
    const startRow = Math.max(0, Math.floor(-pan.y / scaledTileSize));
    const endRow = Math.min(worldState.height, Math.ceil((-pan.y + viewportSize.height) / scaledTileSize));

    const visibleTiles = [];

    for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
            const tile = mapGrid[y][x];
            let tileContent;
            switch (tile.type) {
                case 'city_slot':
                    const island = worldState.islands.find(isl => isl.id === tile.data.islandId);
                    tileContent = <CitySlotTile slotData={tile.data} onClick={onCitySlotClick} isPlacingDummyCity={isPlacingDummyCity} playerAlliance={playerAlliance} gameSettings={gameSettings} cityPoints={cityPoints} scoutedCities={scoutedCities} islandCenterX={island ? island.x : 0} />;
                    break;
                case 'village':
                    tileContent = <FarmingVillageTile villageData={tile.data} onClick={onVillageClick} conqueredVillages={conqueredVillages} gameSettings={gameSettings} />;
                    break;
                case 'ruin':
                    tileContent = <RuinTile ruinData={tile.data} onClick={onRuinClick} gameSettings={gameSettings} />;
                    break;
                case 'god_town':
                    tileContent = <GodTownTile townData={tile.data} onClick={onGodTownClick} gameSettings={gameSettings} />;
                    break;
                case 'wonder_spot':
                    // #comment Pass controlledIslands and playerAlliance to the WonderSpotTile
                    tileContent = <WonderSpotTile spotData={tile.data} onClick={onWonderSpotClick} playerAlliance={playerAlliance} controlledIslands={controlledIslands} />;
                    break;
                case 'constructing_wonder':
                    tileContent = <ConstructingWonderTile wonderData={tile.data} onClick={onConstructingWonderClick} />;
                    break;
                case 'land':
                    tileContent = <LandTile tileData={tile.data} gameSettings={gameSettings} />;
                    break;
                default:
                    tileContent = <WaterTile gameSettings={gameSettings} />;
                    break;
            }
            visibleTiles.push(
                <div
                    key={`tile-${x}-${y}`}
                    className="map-tile"
                    style={{ position: 'absolute', left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
                >
                    {tileContent}
                </div>
            );
        }
    }

    if (gameSettings.animations) {
        movements.forEach(movement => {
            visibleTiles.push(
                <MovementIndicator
                    key={`movement-${movement.id}`}
                    movement={movement}
                    citySlots={locationLookup}
                    allMovements={movements}
                />
            );
        });
    }

    return <>{visibleTiles}</>;
};

export default MapGrid;