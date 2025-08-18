// src/components/SharedReportView.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useGame } from '../contexts/GameContext';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';
import godsConfig from '../gameData/gods.json';
import ruinsResearch from '../gameData/ruinsResearch.json';
import { parseBBCode } from '../utils/bbcodeParser';
import battlePointsImage from '../images/battle_points.png'; // Import the new image
import './ReportsView.css';

const images = {};
const imageContexts = [
    require.context('../images/troops', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/resources', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/gods', false, /\.(png|jpe?g|svg)$/),
];
imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const keyWithSubdir = context.id.includes('/resources') ? `resources/${item.replace('./', '')}` :
                              context.id.includes('/buildings') ? `buildings/${item.replace('./', '')}` :
                              context.id.includes('/gods') ? `gods/${item.replace('./', '')}` :
                              item.replace('./', '');
        images[keyWithSubdir] = context(item);
    });
});

const SharedReportView = ({ reportId, onClose, worldId: propWorldId, isEmbedded, onActionClick }) => {
    const gameContext = useGame();
    const worldId = propWorldId || gameContext?.worldId;
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReport = async () => {
            if (!worldId || !reportId) {
                setError('Invalid report information.');
                setLoading(false);
                return;
            }
            try {
                const reportRef = doc(db, 'worlds', worldId, 'shared_reports', reportId);
                const reportSnap = await getDoc(reportRef);
                if (reportSnap.exists()) {
                    setReport(reportSnap.data());
                } else {
                    setError('This report could not be found. It may have been deleted or is no longer shared.');
                }
            } catch (err) {
                setError('An error occurred while fetching the report.');
                console.error(err);
            }
            setLoading(false);
        };

        fetchReport();
    }, [worldId, reportId]);

    const handleContentClick = (e) => {
        if (!onActionClick) return;
        const target = e.target;
        if (target.classList.contains('bbcode-action')) {
            const { actionType, actionId, actionOwnerId, actionCoordsX, actionCoordsY } = target.dataset;
            if (actionType === 'city_link') {
                onActionClick(actionType, { cityId: actionId, ownerId: actionOwnerId, coords: { x: actionCoordsX, y: actionCoordsY } });
            } else {
                const data = actionId || { x: actionCoordsX, y: actionCoordsY };
                if (actionType && data) {
                    onActionClick(actionType, data);
                }
            }
        }
    };

    const renderUnitList = (units) => {
        if (!units || Object.keys(units).length === 0) return 'None';
        return Object.entries(units)
            .map(([id, count]) => `${count} ${unitConfig[id]?.name || id}`)
            .join(', ');
    };

    const getImageUrl = (imageName) => {
        if (!imageName || !images[imageName]) {
            return '';
        }
        return images[imageName];
    };

    const renderTroopDisplay = (units) => {
        if (!units || Object.keys(units).length === 0) return null;
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Object.entries(units).map(([unitId, count]) => {
                    if (count > 0) {
                        const unit = unitConfig[unitId];
                        const imageSrc = getImageUrl(unit?.image || '');
                        return (
                            <div key={unitId} className="flex flex-col items-center">
                                {imageSrc && <img src={imageSrc} alt={unit?.name || unitId} className="w-8 h-8"/>}
                                <span className="text-sm">{count}</span>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const renderResourceIcons = (resources) => {
        return Object.entries(resources || {}).map(([res, amount]) => {
            const imagePath = `resources/${res}.png`;
            const imageSrc = getImageUrl(imagePath);
            return (
                <div key={res} className="flex flex-col items-center mx-2">
                    {imageSrc && <img src={imageSrc} alt={res} className="w-8 h-8"/>}
                    <span className="text-sm">{Math.floor(amount)}</span>
                </div>
            );
        });
    };

    const renderBuildingDisplay = (buildings) => {
        if (!buildings || Object.keys(buildings).length === 0) return null;
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Object.entries(buildings).map(([buildingId, data]) => {
                    if (data.level > 0) {
                        const building = buildingConfig[buildingId];
                        const imageSrc = getImageUrl(`buildings/${building?.image}` || '');
                        return (
                            <div key={buildingId} className="flex flex-col items-center">
                                {imageSrc && <img src={imageSrc} alt={building?.name || buildingId} className="w-8 h-8"/>}
                                <span className="text-sm">{building?.name || buildingId} (Lvl {data.level})</span>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const renderReportOutcome = (report) => {
        const outcome = report.outcome || {};
        const attacker = report.attacker || {};
        const defender = report.defender || {};
        switch (report.type) {
            case 'attack_god_town':
            case 'attack':
            case 'attack_village':
                const battlePointsGained = report.title.startsWith('Attack') ? outcome.attackerBattlePoints : outcome.defenderBattlePoints;
                return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-600' : 'text-red-600'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex flex-col items-center w-1/3">
                                <p className="font-bold text-lg" dangerouslySetInnerHTML={{ __html: parseBBCode(`[city id=${attacker.cityId} owner=${attacker.ownerId} x=${attacker.x} y=${attacker.y}]${attacker.cityName}[/city]`) }}></p>
                                <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: parseBBCode(`[player id=${attacker.ownerId}]${attacker.username}[/player]`) }}></p>
                                {attacker.allianceId && <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: parseBBCode(`[alliance id=${attacker.allianceId}]${attacker.allianceName || attacker.allianceId}[/alliance]`) }}></p>}
                            </div>
                            <div className="w-1/3 text-center">
                                <img src={getImageUrl('swordman.png')} alt="Attack Icon" className="mx-auto h-12 w-auto"/>
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                               {defender.cityName ? (
                                    <>
                                        <p className="font-bold text-lg" dangerouslySetInnerHTML={{ __html: parseBBCode(`[city id=${defender.cityId} owner=${defender.ownerId} x=${defender.x} y=${defender.y}]${defender.cityName}[/city]`) }}></p>
                                        <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: parseBBCode(`[player id=${defender.ownerId}]${defender.username}[/player]`) }}></p>
                                        {defender.allianceId && <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: parseBBCode(`[alliance id=${defender.allianceId}]${defender.allianceName || defender.allianceId}[/alliance]`) }}></p>}
                                    </>
                                ) : (
                                    <p className="font-bold text-lg">{defender.villageName || defender.ruinName || 'Unknown Target'}</p>
                                )}
                            </div>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                                {outcome.wounded && Object.keys(outcome.wounded).length > 0 && (
                                    <p className="mt-2 text-orange-600"><strong>Wounded:</strong> {renderUnitList(outcome.wounded)}</p>
                                )}
                            </div>
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Defender Units</h4>
                                {outcome.message ? (
                                    <p className="text-gray-500 italic">Unknown</p>
                                ) : (
                                    <>
                                        {renderTroopDisplay(defender.units || defender.troops)}
                                        <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {outcome.attackerWon && outcome.plunder && (
                            <div className="w-full p-3 bg-green-800/10 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-green-700 mb-2">Plundered Resources</h4>
                                <div className="flex justify-center">
                                    {renderResourceIcons(outcome.plunder)}
                                </div>
                            </div>
                        )}
                        {typeof battlePointsGained === 'number' && (
                            <div className="w-full p-3 bg-blue-800/10 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-blue-700 mb-2">Battle Points Gained</h4>
                                <div className="flex items-center justify-center">
                                    <img src={battlePointsImage} alt="Battle Points" className="w-6 h-6 mr-2"/>
                                    <p>{battlePointsGained.toLocaleString()}</p>
                                </div>
                            </div>
                        )}
                        {outcome.message && <p className="text-gray-500 mt-4 italic">{outcome.message}</p>}
                    </div>
                );
            case 'attack_ruin':
                 return (
                    <div className="flex flex-col items-center">
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-600' : 'text-red-600'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                         <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Attacker Units</h4>
                                {renderTroopDisplay(attacker.units)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                            </div>
                            <div className="p-3 bg-black/5 rounded flex flex-col items-center">
                                <h4 className="font-semibold text-lg text-yellow-700 mb-2">Guardian Units</h4>
                                {renderTroopDisplay(defender.troops)}
                                <p className="mt-2"><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                        </div>
                        {report.reward && (
                            <div className="w-full p-3 bg-green-800/10 rounded mt-4 text-center">
                                <h4 className="font-semibold text-lg text-green-700 mb-2">Research Unlocked!</h4>
                                <p>{ruinsResearch[report.reward]?.name}</p>
                            </div>
                        )}
                    </div>
                );
            case 'scout':
                const scoutedGod = (report.god && report.playerReligion) ? godsConfig[report.playerReligion.toLowerCase()]?.[report.god] : null;
                return (
                    <div className="space-y-3">
                        {report.scoutSucceeded ? (
                            <>
                                <p className="font-bold text-green-600 text-lg">Scout Successful!</p>
                                {scoutedGod && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <p><strong>Worshipped God:</strong> {scoutedGod.name}</p>
                                        <img src={getImageUrl(`gods/${scoutedGod.image}`)} alt={scoutedGod.name} className="w-8 h-8"/>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Resources:</h5>
                                    <div className="flex flex-wrap gap-2">{renderResourceIcons(report.resources)}</div>
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Units:</h5>
                                    {renderTroopDisplay(report.units)}
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold text-yellow-700">Buildings:</h5>
                                    {renderBuildingDisplay(report.buildings)}
                                </div>
                            </>
                        ) : (
                            <p className="font-bold text-red-600">{report.message || 'Scout Failed!'}</p>
                        )}
                    </div>
                );
            default:
                return <p>This type of report cannot be shared.</p>;
        }
    };

    if (isEmbedded) {
        if (loading) return <div className="text-xs">Loading report...</div>;
        if (error) return <div className="text-xs text-red-500">{error}</div>;
        if (!report) return null;
        return (
            <div className="p-2 border border-yellow-800/50 my-2" onClick={handleContentClick}>
                <h4 className="font-bold text-center text-sm mb-2">{report.title}</h4>
                {renderReportOutcome(report)}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center" onClick={onClose}>
            <div className="reports-container" onClick={e => e.stopPropagation()}>
                <div className="reports-header">
                    <h2 className="font-title text-3xl">Shared Report</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="p-4 overflow-y-auto" onClick={handleContentClick}>
                    {loading && <p>Loading report...</p>}
                    {error && <p className="text-red-500 text-center">{error}</p>}
                    {report && (
                        <div>
                            <h3 className="text-lg font-bold mb-2 text-center">{report.title}</h3>
                            <p className="text-xs text-center text-gray-500 mb-4">{report.timestamp?.toDate().toLocaleString()}</p>
                            {renderReportOutcome(report)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SharedReportView;
