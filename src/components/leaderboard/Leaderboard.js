import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, collectionGroup, query, where } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import allianceResearch from '../../gameData/allianceResearch.json';
import battlePointsImage from '../../images/battle_points.png';
import './Leaderboard.css';

let leaderboardCache = {
    playerLeaderboard: null,
    allianceLeaderboard: null,
    fightersLeaderboard: null,
    lastFetchTimestamp: 0,
};

export const clearLeaderboardCache = () => {
    leaderboardCache = {
        playerLeaderboard: null,
        allianceLeaderboard: null,
        fightersLeaderboard: null,
        lastFetchTimestamp: 0,
    };
};

const Leaderboard = ({ onClose, onOpenProfile, onOpenAllianceProfile }) => {
    const { worldId, worldState } = useGame();
    const [playerLeaderboard, setPlayerLeaderboard] = useState([]);
    const [allianceLeaderboard, setAllianceLeaderboard] = useState([]);
    const [fightersLeaderboard, setFightersLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('players');

    const fetchAllPlayerData = useCallback(async () => {
        if (!worldId || !worldState) return new Map();

        const gamesGroupRef = collectionGroup(db, 'games');
        const q = query(gamesGroupRef, where('worldName', '==', worldState.name));
        const gamesSnapshot = await getDocs(q);

        const userIds = [];
        const gameDataMap = new Map();
        gamesSnapshot.forEach(gameDoc => {
            const userId = gameDoc.ref.parent.parent.id;
            userIds.push(userId);
            gameDataMap.set(userId, gameDoc.data());
        });

        if (userIds.length === 0) return new Map();

        const usersMap = new Map();
        const userDocsPromises = [];
        for (let i = 0; i < userIds.length; i += 30) {
            const chunk = userIds.slice(i, i + 30);
            const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
            userDocsPromises.push(getDocs(usersQuery));
        }
        
        const userDocsSnapshots = await Promise.all(userDocsPromises);
        userDocsSnapshots.forEach(snapshot => {
            snapshot.forEach(userDoc => {
                usersMap.set(userDoc.id, userDoc.data());
            });
        });

        const playersData = new Map();
        for (const [userId, gameData] of gameDataMap.entries()) {
            const userData = usersMap.get(userId);
            if (userData) {
                playersData.set(userId, {
                    id: userId,
                    username: userData.username,
                    alliance: gameData.alliance || 'No Alliance',
                    points: gameData.totalPoints || 0,
                    battlePoints: gameData.battlePoints || 0,
                    cities: gameData.cityCount || 0,
                });
            }
        }
        return playersData;
    }, [worldId, worldState]);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            setLoading(true);
            const allPlayerData = await fetchAllPlayerData();

            const playersList = Array.from(allPlayerData.values());
            playersList.sort((a, b) => b.points - a.points);
            
            const fightersList = Array.from(allPlayerData.values());
            fightersList.sort((a, b) => b.battlePoints - a.battlePoints);

            const alliancesData = [];
            if (worldId) {
                const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
                const alliancesSnapshot = await getDocs(alliancesRef);
                for (const allianceDoc of alliancesSnapshot.docs) {
                    const alliance = allianceDoc.data();
                    let totalPoints = 0;
                    let totalCities = 0;
                    alliance.members.forEach(member => {
                        if (allPlayerData.has(member.uid)) {
                            const memberData = allPlayerData.get(member.uid);
                            totalPoints += memberData.points;
                            totalCities += memberData.cities;
                        }
                    });
                    
                    const baseMax = 20;
                    const researchLevel = alliance.research?.expanded_charter?.level || 0;
                    const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
                    const maxMembers = baseMax + researchBonus;

                    alliancesData.push({
                        id: allianceDoc.id,
                        name: alliance.name,
                        tag: alliance.tag,
                        points: totalPoints,
                        cities: totalCities,
                        memberCount: alliance.members.length,
                        maxMembers: maxMembers,
                    });
                }
                alliancesData.sort((a, b) => b.points - a.points);
            }

            setPlayerLeaderboard(playersList);
            setFightersLeaderboard(fightersList);
            setAllianceLeaderboard(alliancesData);

            leaderboardCache = {
                playerLeaderboard: playersList,
                allianceLeaderboard: alliancesData,
                fightersLeaderboard: fightersList,
                lastFetchTimestamp: Date.now(),
            };
            setLoading(false);
        };

        const now = Date.now();
        const twentyMinutes = 20 * 60 * 1000;

        if (now - leaderboardCache.lastFetchTimestamp > twentyMinutes || !leaderboardCache.playerLeaderboard) {
            fetchLeaderboards();
        } else {
            setPlayerLeaderboard(leaderboardCache.playerLeaderboard);
            setAllianceLeaderboard(leaderboardCache.allianceLeaderboard);
            setFightersLeaderboard(leaderboardCache.fightersLeaderboard);
            setLoading(false);
        }
    }, [worldId, fetchAllPlayerData]);

    // #comment Render player table
    const renderPlayerTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th className="text-center">Rank</th>
                    <th className="text-left">Player</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-right">Cities</th>
                    <th className="text-right">Points</th>
                </tr>
            </thead>
            <tbody>
                {playerLeaderboard.map((player, index) => (
                    <tr key={player.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenProfile(player.id)} className="player-name-btn">
                                {player.username}
                            </button>
                        </td>
                        <td className="text-left">{player.alliance}</td>
                        <td className="text-right">{player.cities}</td>
                        <td className="text-right">{player.points.toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    // #comment Render fighters table
    const renderFightersTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th className="text-center">Rank</th>
                    <th className="text-left">Player</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-right">Points</th>
                </tr>
            </thead>
            <tbody>
                {fightersLeaderboard.map((player, index) => (
                    <tr key={player.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenProfile(player.id)} className="player-name-btn">
                                {player.username}
                            </button>
                        </td>
                        <td className="text-left">{player.alliance}</td>
                        <td className="text-right flex items-center justify-end">
                            {player.battlePoints.toLocaleString()}
                            <img src={battlePointsImage} alt="Battle Points" className="w-5 h-5 ml-1 inline-block"/>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    // #comment Render alliance table
    const renderAllianceTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th className="text-center">Rank</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-left">Tag</th>
                    <th className="text-center">Members</th>
                    <th className="text-center">Total Cities</th>
                    <th className="text-right">Points</th>
                </tr>
            </thead>
            <tbody>
                {allianceLeaderboard.map((alliance, index) => (
                    <tr key={alliance.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenAllianceProfile(alliance.id)} className="player-name-btn">
                                {alliance.name}
                            </button>
                        </td>
                        <td className="text-left">{alliance.tag}</td>
                        <td className="text-center">{alliance.memberCount}/{alliance.maxMembers}</td>
                        <td className="text-center">{alliance.cities}</td>
                        <td className="text-right">{alliance.points.toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    // #comment Render content
    const renderContent = () => {
        if (loading) {
            return <p>Loading leaderboard...</p>;
        }
        switch (activeTab) {
            case 'players':
                return renderPlayerTable();
            case 'alliances':
                return renderAllianceTable();
            case 'fighters':
                return renderFightersTable();
            default:
                return renderPlayerTable();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="leaderboard-container" onClick={e => e.stopPropagation()}>
                <div className="leaderboard-header">
                </div>
                <div className="leaderboard-tabs">
                    <button onClick={() => setActiveTab('players')} className={`leaderboard-tab-btn ${activeTab === 'players' ? 'active' : ''}`}>Players</button>
                    <button onClick={() => setActiveTab('alliances')} className={`leaderboard-tab-btn ${activeTab === 'alliances' ? 'active' : ''}`}>Alliances</button>
                    <button onClick={() => setActiveTab('fighters')} className={`leaderboard-tab-btn ${activeTab === 'fighters' ? 'active' : ''}`}>Fighters</button>
                </div>
                <div className="overflow-y-auto flex-grow pr-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
