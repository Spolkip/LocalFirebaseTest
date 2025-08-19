import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import unitConfig from '../../gameData/units.json';
import researchConfig from '../../gameData/research.json';
import buildingConfig from '../../gameData/buildings.json';
import './managementPanel.css';

const ManagementPanel = ({ onClose }) => {
    const { playerCities } = useGame();
    const [activeTab, setActiveTab] = useState('troops');

    const renderTroopManagement = () => {
        const allTroops = {};
        Object.values(playerCities).forEach(city => {
            Object.entries(city.units).forEach(([unitId, count]) => {
                if (unitConfig[unitId]) {
                    allTroops[unitId] = (allTroops[unitId] || 0) + count;
                }
            });
        });

        return (
            <div>
                <h3 className="management-header">Troop Overview</h3>
                <div className="management-grid">
                    {Object.entries(allTroops).map(([unitId, count]) => (
                        <div key={unitId} className="management-item">
                            <p className="item-name">{unitConfig[unitId].name}</p>
                            <p className="item-count">Total: {count}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderResearchManagement = () => {
        const allResearch = {};
        Object.values(playerCities).forEach(city => {
            Object.keys(city.research || {}).forEach(researchId => {
                if (researchConfig[researchId]) {
                    allResearch[researchId] = true;
                }
            });
        });

        return (
            <div>
                <h3 className="management-header">Research Overview</h3>
                <div className="management-grid">
                    {Object.entries(researchConfig).map(([id, research]) => (
                        <div key={id} className={`management-item ${allResearch[id] ? 'completed' : ''}`}>
                            <p className="item-name">{research.name}</p>
                            <p className="item-status">{allResearch[id] ? 'Completed' : 'Not Researched'}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderBuildingManagement = () => {
        const buildingLevels = {};
        Object.values(playerCities).forEach(city => {
            Object.entries(city.buildings).forEach(([buildingId, data]) => {
                if (buildingConfig[buildingId]) {
                    if (!buildingLevels[buildingId]) {
                        buildingLevels[buildingId] = [];
                    }
                    buildingLevels[buildingId].push(data.level);
                }
            });
        });

        return (
            <div>
                <h3 className="management-header">Building Overview</h3>
                <div className="management-grid">
                    {Object.entries(buildingLevels).map(([buildingId, levels]) => (
                        <div key={buildingId} className="management-item">
                            <p className="item-name">{buildingConfig[buildingId].name}</p>
                            <p className="item-count">Levels: {levels.join(', ')}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'troops':
                return renderTroopManagement();
            case 'research':
                return renderResearchManagement();
            case 'buildings':
                return renderBuildingManagement();
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="management-panel-container" onClick={e => e.stopPropagation()}>
                <div className="management-panel-header">
                    <h2>Imperial Manager</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="management-tabs">
                    <button onClick={() => setActiveTab('troops')} className={activeTab === 'troops' ? 'active' : ''}>Troops</button>
                    <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                    <button onClick={() => setActiveTab('buildings')} className={activeTab === 'buildings' ? 'active' : ''}>Buildings</button>
                </div>
                <div className="management-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default ManagementPanel;
