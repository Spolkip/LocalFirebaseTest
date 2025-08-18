import React from 'react';

const SpecialBuildingPlot = ({ building, onClick, image, name, isConstructed }) => {
    const { position } = building;
    const spotStyle = {
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: '200px',
        height: '150px',
        backgroundImage: isConstructed && image ? `url(${image})` : 'none',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
    };

    if (!isConstructed) {
        return (
             <div
                className="building-spot absolute flex items-center justify-center p-2 rounded-lg cursor-pointer hover:bg-black/20"
                style={spotStyle}
                onClick={onClick}
                title={`Build ${name}`}
            >
                <span className="text-gray-400 text-sm">
                    Empty Plot
                </span>
            </div>
        );
    }

    return (
        <div
            className="building-spot absolute flex flex-col items-center justify-end p-2 rounded-lg transition-colors duration-200 cursor-pointer"
            style={{
                ...spotStyle,
                backgroundColor: image ? 'transparent' : 'rgba(139, 69, 19, 0.7)',
            }}
            onClick={onClick}
            title={name}
        >
            {/* #comment Added a label for the constructed building */}
            <span className="text-white text-sm font-bold bg-black/50 px-2 py-1 rounded">{name}</span>
        </div>
    );
};

export default SpecialBuildingPlot;
