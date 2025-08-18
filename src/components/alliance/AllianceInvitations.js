// src/components/alliance/AllianceInvitations.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';

// #comment Cache for player list to reduce reads.
export let playerCache = {
    allPlayers: null,
    timestamp: 0,
};

export const clearPlayerCache = () => {
    playerCache.allPlayers = null;
    playerCache.timestamp = 0;
};

const AllianceInvitations = ({ isLeader }) => {
    const { worldId } = useGame();
    const { playerAlliance, sendAllianceInvitation, revokeAllianceInvitation, handleApplication } = useAlliance();
    const { userProfile } = useAuth();
    const [invitedPlayerName, setInvitedPlayerName] = useState('');
    const [pendingInvites, setPendingInvites] = useState([]);
    const [applications, setApplications] = useState([]);
    const [message, setMessage] = useState('');

    // #comment Autocomplete states
    const [allPlayers, setAllPlayers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    // #comment Fetch all players for autocomplete
    useEffect(() => {
        const fetchPlayers = async () => {
            const now = Date.now();
            const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

            if (now - playerCache.timestamp < CACHE_DURATION && playerCache.allPlayers) {
                setAllPlayers(playerCache.allPlayers);
            } else {
                const usersRef = collection(db, 'users');
                const snapshot = await getDocs(usersRef);
                const players = snapshot.docs
                    .map(doc => doc.data().username)
                    .filter(username => username !== userProfile.username); // Exclude self
                setAllPlayers(players);
                playerCache.allPlayers = players;
                playerCache.timestamp = now;
            }
        };
        fetchPlayers();
    }, [userProfile.username]);

    useEffect(() => {
        if (!worldId || !playerAlliance?.id) return;
        const invitesRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'invitations');
        const unsubscribeInvites = onSnapshot(invitesRef, (snapshot) => {
            const invitesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingInvites(invitesData);
        });
        
        // Listener for the alliance document to get applications
        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const unsubscribeApplications = onSnapshot(allianceRef, (docSnap) => {
            if (docSnap.exists()) {
                setApplications(docSnap.data().applications || []);
            }
        });

        return () => {
            unsubscribeInvites();
            unsubscribeApplications();
        };
    }, [worldId, playerAlliance]);

    const handleInvite = async () => {
        if (!invitedPlayerName.trim()) {
            setMessage('Please enter a player name.');
            return;
        }
        setMessage(''); // Clear previous messages

        try {
            const usersQuery = query(collection(db, 'users'), where('username', '==', invitedPlayerName.trim()));
            const userSnapshot = await getDocs(usersQuery);

            if (userSnapshot.empty) {
                setMessage('Player not found.');
                return;
            }
            
            const invitedUserId = userSnapshot.docs[0].id;
            const existingInvite = pendingInvites.find(invite => invite.invitedUserId === invitedUserId);
            if (existingInvite) {
                setMessage('An invitation has already been sent to this player.');
                return;
            }

            await sendAllianceInvitation(invitedUserId);
            setMessage(`Invitation sent to ${invitedPlayerName}!`);
            setInvitedPlayerName('');
        } catch (e) {
            setMessage(e.message); // Display specific error from context
            console.error(e);
        }
    };

    const handleRevoke = async (invitedUserId) => {
        await revokeAllianceInvitation(invitedUserId);
        setMessage('Invitation revoked.');
    };

    const onApplicationAction = async (application, action) => {
        try {
            await handleApplication(application, playerAlliance.id, action);
            setMessage(`Application ${action}ed.`);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    };
    
    // #comment Handle input change for autocomplete
    const handleInviteInputChange = (e) => {
        const value = e.target.value;
        setInvitedPlayerName(value);
        if (value.length > 0) {
            const filteredSuggestions = allPlayers.filter(player =>
                player.toLowerCase().startsWith(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    };

    // #comment Handle clicking a suggestion
    const handleSuggestionClick = (username) => {
        setInvitedPlayerName(username);
        setSuggestions([]);
    };

    const canInvite = isLeader;

    return (
       <div className="p-4 alliance-bg-light alliance-text-light rounded-lg">
            <h3 className="text-xl font-bold mb-4">Invitations & Applications</h3>
            {!canInvite && <p className="text-red-400 mb-4">You do not have permission to manage invitations.</p>}
            {canInvite && (
                <div className="mb-6 space-y-2 autocomplete-suggestions-container">
                    <p className="font-semibold">Invite a Player</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={invitedPlayerName}
                            onChange={handleInviteInputChange}
                            placeholder="Player Username"
                            className="w-full bg-gray-900 p-2 rounded text-white"
                            autoComplete="off"
                        />
                        <button onClick={handleInvite} className="btn btn-confirm flex-shrink-0">Invite</button>
                    </div>
                     {suggestions.length > 0 && (
                        <ul className="autocomplete-suggestions-list dark">
                            {suggestions.map(player => (
                                <li key={player} onClick={() => handleSuggestionClick(player)}>
                                    {player}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p className="font-semibold mb-2">Pending Invitations</p>
                    {pendingInvites.length > 0 ? (
                        <ul className="space-y-2">
                            {pendingInvites.map(invite => (
                                <li key={invite.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                    <span>{invite.invitedUsername}</span>
                                    {canInvite && (
                                        <button onClick={() => handleRevoke(invite.invitedUserId)} className="btn btn-danger text-sm px-2 py-1">Revoke</button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-sm italic">No invitations have been sent.</p>
                    )}
                </div>
                <div>
                    <p className="font-semibold mb-2">Applications</p>
                    {applications.length > 0 ? (
                        <ul className="space-y-2">
                            {applications.map(app => (
                                <li key={app.userId} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                    <span>{app.username}</span>
                                    {canInvite && (
                                        <div className="flex gap-1">
                                            <button onClick={() => onApplicationAction(app, 'accept')} className="btn btn-confirm text-xs px-2 py-1">Accept</button>
                                            <button onClick={() => onApplicationAction(app, 'reject')} className="btn btn-danger text-xs px-2 py-1">Reject</button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-sm italic">No pending applications.</p>
                    )}
                </div>
            </div>
            {message && <p className="text-green-400 mt-2 text-sm">{message}</p>}
        </div>
    );
};

export default AllianceInvitations;
