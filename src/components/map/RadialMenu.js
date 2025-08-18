import React from 'react';
import './RadialMenu.css';

const RadialMenu = ({ actions, centerAction, position, onClose }) => {
    const radius = 50; // Changed from 40
    const angleStep = (2 * Math.PI) / actions.length;

    if (!position) {
        return null;
    }

    return (
        <div className="radial-menu-overlay" onClick={onClose}>
            <div
                className="radial-menu-container"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Center Button */}
                {centerAction && (
                    <button
                        className="radial-menu-item radial-menu-center-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            centerAction.handler();
                            onClose();
                        }}
                        title={centerAction.label}
                    >
                        <span className="radial-menu-icon-wrapper">
                            <span className="radial-menu-icon">{centerAction.icon}</span>
                        </span>
                    </button>
                )}

                {/* Radial Buttons */}
                {actions.map((action, index) => {
                    const angle = index * angleStep - Math.PI / 2;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    return (
                        <button
                            key={index}
                            className="radial-menu-item"
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.handler();
                                onClose();
                            }}
                            title={action.label}
                        >
                            <span className="radial-menu-icon-wrapper">
                                <span className="radial-menu-icon">{action.icon}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RadialMenu;
