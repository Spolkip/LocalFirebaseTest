// src/components/city/Cityscape.js
import React from 'react';
import BuildingSpot from './BuildingSpot';
import SpecialBuildingPlot from './specialBuildingPlotpls';
import buildingLayout from '../../gameData/BuildingLayout.json';
import buildingConfig from '../../gameData/buildings.json'; // Import building config
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import cityBackground from '../../images/city_layout.png'; // Import the new background

const Cityscape = ({ buildings, onBuildingClick, buildingImages, cityGameState, onOpenSpecialBuildingMenu }) => {
  return (
    <div
      style={{
        width: '2000px', // Large canvas for the city
        height: '1200px',
        position: 'relative',
        backgroundImage: `url(${cityBackground})`, // Use the imported image
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* The previous green overlay has been removed */}
      
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
        const config = buildingConfig[building.id]; // Get config for the building
        
        return (
          <BuildingSpot
            key={building.id}
            building={building}
            level={level}
            onClick={() => onBuildingClick(building.id)}
            image={config?.image ? buildingImages[config.image] : null} // Pass image URL
          />
        );
      })}
    </div>
  );
};

export default Cityscape;
