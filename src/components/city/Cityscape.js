import React from 'react';
import BuildingSpot from './BuildingSpot';
import SpecialBuildingPlot from './specialBuildingPlotpls';
import buildingLayout from '../../gameData/BuildingLayout.json';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import cityBackground from '../../images/city_layout.png';
const Cityscape = ({ buildings, onBuildingClick, buildingImages, cityGameState, onOpenSpecialBuildingMenu }) => {
  return (
    <div
      style={{
        width: '2000px',
        height: '1700px',
        position: 'relative',
        backgroundImage: `url(${cityBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {}
      {buildingLayout.map((building) => {
        if (building.id === 'special_building_plot') {
            if (!cityGameState) return null;
            const specialBuildingId = cityGameState.specialBuilding;
            const config = specialBuildingId ? specialBuildingsConfig[specialBuildingId] : buildingConfig.special_building_plot;
            const image = config?.image ? buildingImages[config.image] : null;
            return (
                <SpecialBuildingPlot
                    key={building.id}
                    building={building}
                    onClick={() => onBuildingClick(building.id)}
                    image={image}
                    name={config.name}
                    isConstructed={!!specialBuildingId}
                />
            );
        }
        const buildingData = buildings[building.id];
        const level = buildingData?.level || 0;
        const config = buildingConfig[building.id];
        return (
          <BuildingSpot
            key={building.id}
            building={building}
            level={level}
            onClick={() => onBuildingClick(building.id)}
            image={config?.image ? buildingImages[config.image] : null}
          />
        );
      })}
    </div>
  );
};
export default Cityscape;