// src/components/city/BuildingSpot.js
import React from 'react';

const BuildingSpot = ({ building, level, onClick, image }) => {
    const { id, name, position } = building;
    const isCityWall = id === 'city_wall';

    // Define styles based on whether it's the city wall or not
    const spotStyle = {
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: isCityWall ? '2000px' : '200px',
        height: isCityWall ? '150px' : '150px', // Increased height for the wall
        backgroundImage: level > 0 && image ? `url(${image})` : 'none',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
    };

    if (level === 0) {
        return (
             <div
                className="building-spot absolute flex items-center justify-center p-2 rounded-lg cursor-pointer hover:bg-black/20"
                style={spotStyle}
                onClick={onClick}
                title={`Build ${name}`}
            >
                <span className="text-gray-400 text-sm">
                    {isCityWall ? `Build ${name}` : 'Empty Plot'}
                </span>
            </div>
        );
    }

    return (
        <div
            className="building-spot absolute flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 cursor-pointer"
            style={{
                ...spotStyle,
                backgroundColor: image ? 'transparent' : 'rgba(139, 69, 19, 0.7)', // If there's an image, the background is transparent.
            }}
            onClick={onClick}
        >
        </div>
    );
};

export default BuildingSpot;
