import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCityState } from '../../hooks/useCityState';
import unitConfig from '../../gameData/units.json';
import './ProfileView.css';
import TextEditor from '../shared/TextEditor';
import placeholder_profile from '../../images/placeholder_profile.png';

// #comment Cache for player profile data.
const profileCache = {};

// #comment Function to clear the profile cache, exported for admin use.
export const clearProfileCache = () => {
    for (const key in profileCache) {
        delete profileCache[key];
    }
};

const ProfileView = ({ onClose, viewUserId, onGoToCity, onInviteToAlliance, onOpenAllianceProfile }) => {
    const { currentUser, userProfile: ownUserProfile, updateUserProfile } = useAuth();
    const { worldId } = useGame();
    const { playerAlliance } = useAlliance();
    const { calculateTotalPoints } = useCityState(worldId);

    const [profileData, setProfileData] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [cities, setCities] = useState([]);
    const [points, setPoints] = useState(0);
    const [totalAttack, setTotalAttack] = useState(0);
    const [totalDefense, setTotalDefense] = useState(0);
    const [loading, setLoading] = useState(true);

    const [newDescription, setNewDescription] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const isOwnProfile = !viewUserId || viewUserId === currentUser.uid;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const userId = viewUserId || currentUser.uid;

            try {
                // Fetch user profile
                const userDocRef = doc(db, "users", userId);
                const userDocSnap = await getDoc(userDocRef);
                let userData = null;
                if (userDocSnap.exists()) {
                    userData = userDocSnap.data();
                    setProfileData(userData);
                    setNewDescription(userData.description || '');
                    setNewImageUrl(userData.imageUrl || '');
                }

                // Fetch top-level game data (for alliance info)
                const gameDocRef = doc(db, `users/${userId}/games`, worldId);
                const gameDocSnap = await getDoc(gameDocRef);
                const gameData = gameDocSnap.exists() ? gameDocSnap.data() : null;
                setGameData(gameData);

                // Fetch all cities for the user in this world
                const citiesColRef = collection(db, `users/${userId}/games`, worldId, 'cities');
                const citiesSnap = await getDocs(citiesColRef);
                const citiesList = citiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCities(citiesList);


                let calculatedPoints = 0;
                let calculatedAttack = 0;
                let calculatedDefense = 0;
                for (const city of citiesList) {
                    calculatedPoints += calculateTotalPoints(city);
                    if (city.units) {
                        for (const [unitId, count] of Object.entries(city.units)) {
                            const unit = unitConfig[unitId];
                            if (unit) {
                                calculatedAttack += (unit.attack || 0) * count;
                                calculatedDefense += (unit.defense || 0) * count;
                            }
                        }
                    }
                }
                setPoints(calculatedPoints);
                setTotalAttack(calculatedAttack);
                setTotalDefense(calculatedDefense);

                // #comment Update cache
                profileCache[userId] = {
                    data: {
                        profileData: userData,
                        gameData,
                        cities: citiesList,
                        points: calculatedPoints,
                        totalAttack: calculatedAttack,
                        totalDefense: calculatedDefense,
                    },
                    timestamp: Date.now(),
                };

            } catch (error) {
                console.error("Error fetching user data:", error);
            }
            setLoading(false);
        };

        const userId = viewUserId || currentUser.uid;
        const now = Date.now();
        const twentyMinutes = 20 * 60 * 1000;

        if (profileCache[userId] && (now - profileCache[userId].timestamp < twentyMinutes)) {
            const cached = profileCache[userId].data;
            setProfileData(cached.profileData);
            setGameData(cached.gameData);
            setCities(cached.cities);
            setPoints(cached.points);
            setTotalAttack(cached.totalAttack);
            setTotalDefense(cached.totalDefense);
            setNewDescription(cached.profileData.description || '');
            setNewImageUrl(cached.profileData.imageUrl || '');
            setLoading(false);
        } else {
            fetchData();
        }
    }, [viewUserId, currentUser.uid, worldId, calculateTotalPoints]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!isOwnProfile) return;

        const profileUpdateData = {
            description: newDescription,
            imageUrl: newImageUrl,
        };
        try {
            await updateUserProfile(profileUpdateData);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile.", error);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="text-white">Loading Profile...</div>
            </div>
        );
    }

    const displayProfile = isOwnProfile ? ownUserProfile : profileData;

    const getOcean = (x, y) => {
        if (x === undefined || y === undefined) return '?';
        return `${Math.floor(y / 10)}${Math.floor(x / 10)}`;
    };


    const canInvite = (() => {
        if (!playerAlliance || isOwnProfile) {
            return false;
        }
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return false;
        const rank = playerAlliance.ranks.find(r => r.id === member.rank);
        return rank?.permissions?.inviteMembers || false;
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="profile-papyrus !h-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="profile-close-button">&times;</button>
                <div className="profile-grid">
                    <div className="profile-left-column">
                        <div className="profile-box">
                            <div className="profile-box-header">{displayProfile?.username}</div>
                            <div className="player-info-content">
                                {gameData?.alliance ? (
                                    <button
                                        onClick={() => onOpenAllianceProfile(gameData.alliance)}
                                        className="text-blue-400 hover:underline font-bold"
                                    >
                                        [{gameData.alliance}]
                                    </button>
                                ) : 'No Alliance'}
                            </div>
                            <div className="player-stats">
                                <div className="stat-item"><span>⚔️ Attack Points</span> <span>{totalAttack.toLocaleString()}</span></div>
                                <div className="stat-item"><span>🛡️ Defense Points</span> <span>{totalDefense.toLocaleString()}</span></div>
                                <div className="stat-item"><span>🏆 Total Points</span> <span>{points.toLocaleString()}</span></div>
                            </div>
                        </div>
                        {/* #comment Added flex-grow and min-h-0 to allow the cities list to grow and scroll */}
                        <div className="profile-box flex-grow min-h-0">
                            <div className="profile-box-header flex justify-between items-center">
                                <span>Cities ({cities.length})</span>
                                <button className="text-xs bg-gray-500/50 px-2 py-0.5 rounded">BBCode</button>
                            </div>
                            <div className="cities-list overflow-y-auto">
                                {cities.length > 0 ? (
                                    cities.map(city => (
                                        <div key={city.id} className="city-item">
                                            <button onClick={() => onGoToCity(city.x, city.y)} className="city-name-btn">
                                                {city.cityName}
                                            </button>
                                            <span>{calculateTotalPoints(city).toLocaleString()} points | Ocean {getOcean(city.x, city.y)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-center p-4">No cities in this world.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="profile-right-column">
                        <div className="profile-box">
                            <div className="profile-box-header">Profile</div>
                            <div className="profile-description-box">
                                <img 
                                    src={displayProfile?.imageUrl || placeholder_profile} 
                                    onError={(e) => { e.target.onerror = null; e.target.src=placeholder_profile; }}
                                    alt="Profile Avatar" 
                                    className="profile-avatar-large" 
                                />
                                <div className="profile-description-text">
                                    {isEditing ? (
                                        <form onSubmit={handleUpdateProfile} className="h-full flex flex-col">
                                            <TextEditor value={newDescription} onChange={setNewDescription} />
                                            <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL" className="w-full mt-2 bg-white/50 border border-yellow-800/50 p-1" />
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel">Cancel</button>
                                                <button type="submit" className="btn-save">Save</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <p>{displayProfile?.description || 'This player has not written a profile text.'}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 {isOwnProfile && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="profile-edit-button">Edit Profile</button>
                )}
                {canInvite && (
                    <button onClick={() => onInviteToAlliance(viewUserId)} className="profile-edit-button">
                        Invite to Alliance
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfileView;