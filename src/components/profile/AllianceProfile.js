import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';
import './AllianceProfile.css';

const allianceProfileCache = {};

const AllianceProfile = ({ allianceId, onClose, onOpenProfile }) => {
    const { worldId, worldState } = useGame();
    const [allianceData, setAllianceData] = useState(null);
    const [membersData, setMembersData] = useState([]);
    const [loading, setLoading] = useState(true);

    // #comment Fetch all member data for the alliance
    const fetchAllMemberData = useCallback(async (members) => {
        if (!worldId || !worldState || !members || members.length === 0) return [];
        const memberIds = members.map(m => m.uid);
        
        const memberPoints = {};
        
        // #comment Firestore 'in' queries are limited to 30 items, so we chunk the requests.
        for (let i = 0; i < memberIds.length; i += 30) {
            const chunk = memberIds.slice(i, i + 30);
            if (chunk.length > 0) {
                const gamesGroupRef = collectionGroup(db, 'games');
                const q = query(gamesGroupRef, where('worldName', '==', worldState.name), where('__name__', 'in', chunk.map(id => `users/${id}/games/${worldId}`)));
                const gamesSnapshot = await getDocs(q);
                gamesSnapshot.forEach(gameDoc => {
                    const userId = gameDoc.ref.parent.parent.id;
                    memberPoints[userId] = gameDoc.data().totalPoints || 0;
                });
            }
        }

        return members.map(member => ({
            ...member,
            points: memberPoints[member.uid] || 0,
        })).sort((a, b) => b.points - a.points);

    }, [worldId, worldState]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
                const allianceDocSnap = await getDoc(allianceDocRef);

                if (allianceDocSnap.exists()) {
                    const alliance = allianceDocSnap.data();
                    setAllianceData(alliance);

                    const detailedMembers = await fetchAllMemberData(alliance.members);
                    setMembersData(detailedMembers);

                    allianceProfileCache[allianceId] = {
                        data: { alliance, members: detailedMembers },
                        timestamp: Date.now()
                    };
                }
            } catch (error) {
                console.error("Error fetching alliance data:", error);
            }
            setLoading(false);
        };

        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (allianceProfileCache[allianceId] && (now - allianceProfileCache[allianceId].timestamp < CACHE_DURATION)) {
            const cached = allianceProfileCache[allianceId].data;
            setAllianceData(cached.alliance);
            setMembersData(cached.members);
            setLoading(false);
        } else {
            fetchData();
        }
    }, [allianceId, worldId, fetchAllMemberData]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="text-white">Loading Alliance Profile...</div>
            </div>
        );
    }

    if (!allianceData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="profile-papyrus" onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} className="profile-close-button">&times;</button>
                    <p className="text-center">Alliance not found.</p>
                </div>
            </div>
        );
    }

    const totalPoints = membersData.reduce((sum, member) => sum + member.points, 0);

    // #comment Render alliance information
    const renderAllianceInfo = () => (
        <div className="profile-box">
            <div className="profile-box-header">{allianceData.name} [{allianceData.tag}]</div>
            <div className="player-info-content">
                Leader: <button onClick={() => onOpenProfile(allianceData.leader.uid)} className="text-blue-400 hover:underline font-bold">{allianceData.leader.username}</button>
            </div>
            <div className="player-stats">
                <div className="stat-item"><span>👥 Members</span> <span>{allianceData.members.length}</span></div>
                <div className="stat-item"><span>🏆 Total Points</span> <span>{totalPoints.toLocaleString()}</span></div>
            </div>
        </div>
    );

    // #comment Render member list
    const renderMemberList = () => (
        <div className="profile-box h-full flex flex-col">
            <div className="profile-box-header">Members</div>
            <div className="cities-list overflow-y-auto flex-grow">
                {membersData.map(member => (
                    <div key={member.uid} className="city-item">
                        <button onClick={() => onOpenProfile(member.uid)} className="city-name-btn">
                            {member.username} ({member.rank})
                        </button>
                        <span>{member.points.toLocaleString()} points</span>
                    </div>
                ))}
            </div>
        </div>
    );

    // #comment Render description
    const renderDescription = () => (
        <div className="profile-box flex-grow min-h-0 flex flex-col">
            <div className="profile-box-header">Description</div>
            <div className="profile-description-box">
                <div className="profile-description-text">
                    <p>{allianceData.settings.description || 'This alliance has no public description.'}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="profile-papyrus" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="profile-close-button">&times;</button>
                <div className="profile-grid">
                    <div className="profile-left-column">
                        {renderAllianceInfo()}
                        {renderDescription()}
                    </div>
                    <div className="profile-right-column">
                        {renderMemberList()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllianceProfile;
