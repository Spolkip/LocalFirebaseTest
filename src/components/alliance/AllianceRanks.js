// src/components/alliance/AllianceRanks.js
import React, { useState, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const AllianceRanks = ({ alliance, isLeader }) => {
    const { createAllianceRank, updateAllianceMemberRank, updateRanksOrder, updateAllianceRank, deleteAllianceRank } = useAlliance();
    const { userProfile } = useAuth();
    const { worldId } = useGame();
    const [newRankName, setNewRankName] = useState('');
    const [newRankPermissions, setNewRankPermissions] = useState({
        manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false, viewSecretForums: false, manageBank: false, withdrawFromBank: false, proposeTreaties: false, viewMemberActivity: false
    });
    const [message, setMessage] = useState('');
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [editingRank, setEditingRank] = useState(null);

    const allPermissions = Object.keys(newRankPermissions);
    
    const handleCreateRank = () => {
        if (!isLeader) return;
        setMessage('');
        if (newRankName.trim() === '') {
            setMessage('Rank name cannot be empty.');
            return;
        }
        if (alliance.ranks.some(r => r.name.toLowerCase() === newRankName.trim().toLowerCase())) {
            setMessage('A rank with this name already exists.');
            return;
        }
        if (alliance.ranks.length >= 10) {
            setMessage('Maximum of 10 ranks reached.');
            return;
        }

        createAllianceRank({
            id: newRankName.trim(),
            name: newRankName.trim(),
            permissions: newRankPermissions,
        });

        setNewRankName('');
        setNewRankPermissions({
            manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false, viewSecretForums: false, manageBank: false, withdrawFromBank: false, proposeTreaties: false, viewMemberActivity: false
        });
        setMessage('Rank created!');
    };

    const handleUpdateMemberRank = async (memberId, newRankId) => {
        if (!isLeader) return;
        setMessage('');
        try {
            const memberToUpdate = alliance.members.find(m => m.uid === memberId);
            const oldRankId = memberToUpdate.rank;

            await updateAllianceMemberRank(memberId, newRankId);

            if (oldRankId !== newRankId) {
                const oldRankIndex = alliance.ranks.findIndex(r => r.id === oldRankId);
                const newRankIndex = alliance.ranks.findIndex(r => r.id === newRankId);
                
                if (oldRankIndex !== -1 && newRankIndex !== -1) {
                    const actionText = newRankIndex < oldRankIndex ? 'promoted' : 'demoted';
                    const memberUsername = memberToUpdate.username;
                    const eventText = `${userProfile.username} has ${actionText} ${memberUsername} to ${newRankId}.`;

                    const eventsRef = collection(db, 'worlds', worldId, 'alliances', alliance.id, 'events');
                    await addDoc(eventsRef, {
                        type: 'rank_change',
                        text: eventText,
                        timestamp: serverTimestamp(),
                    });
                }
            }

            setMessage('Member rank updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('Failed to update rank. Please try again.');
            console.error('Error updating member rank:', error);
        }
    };
    
    const handleMoveRank = async (index, direction) => {
        if (!isLeader || index === 0) return;

        const newRanks = [...alliance.ranks];
        const rankToMove = newRanks[index];

        if (direction === 'up' && index > 1) {
            newRanks.splice(index, 1);
            newRanks.splice(index - 1, 0, rankToMove);
        } else if (direction === 'down' && index < newRanks.length - 1) {
            newRanks.splice(index, 1);
            newRanks.splice(index + 1, 0, rankToMove);
        } else {
            return;
        }

        try {
            await updateRanksOrder(newRanks); 
            setMessage('Rank order updated.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('Failed to update rank order.');
            console.error(error);
        }
    };

    const handleStartEdit = (rank) => {
        setEditingRank({ ...rank });
    };

    const handleCancelEdit = () => {
        setEditingRank(null);
    };

    const handleSaveEdit = async () => {
        if (!editingRank || !editingRank.name.trim()) {
            setMessage("Rank name cannot be empty.");
            return;
        }
        if (alliance.ranks.some(r => r.name.toLowerCase() === editingRank.name.trim().toLowerCase() && r.id !== editingRank.id)) {
            setMessage('A rank with this name already exists.');
            return;
        }
        try {
            await updateAllianceRank(editingRank.id, { name: editingRank.name, permissions: editingRank.permissions });
            setMessage("Rank updated successfully.");
            setEditingRank(null);
        } catch (error) {
            setMessage(`Error updating rank: ${error.message}`);
        }
    };

    const handleDeleteRank = async (rankId) => {
        setMessage('');
        if (window.confirm(`Are you sure you want to delete the rank "${rankId}"? This cannot be undone.`)) {
            try {
                await deleteAllianceRank(rankId);
                setMessage("Rank deleted successfully.");
            } catch (error) {
                setMessage(`Error deleting rank: ${error.message}`);
            }
        }
    };

    const getPermissionsText = (permissions) => {
        const enabledPermissions = Object.entries(permissions || {})
            .filter(([, value]) => value)
            .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());
        
        if (enabledPermissions.length === 0) {
            return 'No special permissions.';
        }
        return `Permissions: ${enabledPermissions.join(', ')}`;
    };

    const sortedMembers = useMemo(() => {
        return [...(alliance.members || [])].sort((a, b) => {
            if (a.rank === 'Leader') return -1;
            if (b.rank === 'Leader') return 1;
            return a.username.localeCompare(b.username);
        });
    }, [alliance.members]);

     return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Alliance Ranks</h3>
            {!isLeader && <p className="text-red-600 mb-4">Only the leader can manage ranks.</p>}
            
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-lg mb-2 text-gray-900">Current Ranks</h4>
                    <ul className="space-y-2">
                        {alliance.ranks.map((rank, index) => (
                            <li key={rank.id} className="bg-white text-gray-900 p-3 rounded border border-amber-200">
                                {editingRank?.id === rank.id ? (
                                    <div className="w-full">
                                        <input
                                            type="text"
                                            value={editingRank.name}
                                            onChange={(e) => setEditingRank(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-amber-50 text-gray-900 p-2 rounded border border-amber-300 mb-2"
                                        />
                                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                            {allPermissions.map(perm => (
                                                <div key={perm} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`edit-${perm}`}
                                                        checked={editingRank.permissions[perm]}
                                                        onChange={(e) => setEditingRank(prev => ({ ...prev, permissions: { ...prev.permissions, [perm]: e.target.checked } }))}
                                                        className="mr-2"
                                                    />
                                                    <label htmlFor={`edit-${perm}`} className="capitalize text-gray-900">{perm.replace(/([A-Z])/g, ' $1')}</label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleCancelEdit} className="btn btn-secondary">Cancel</button>
                                            <button onClick={handleSaveEdit} className="btn btn-confirm">Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center w-full">
                                        <div title={getPermissionsText(rank.permissions)}>
                                            <p className="font-bold">{rank.name}</p>
                                            <p className="text-xs text-amber-800 mt-1">{getPermissionsText(rank.permissions)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isLeader && rank.id !== 'Leader' && (
                                                <>
                                                    <button onClick={() => handleStartEdit(rank)} className="text-xs btn btn-primary px-2 py-1">Edit</button>
                                                    <button onClick={() => handleDeleteRank(rank.id)} className="text-xs btn btn-danger px-2 py-1">Delete</button>
                                                    <div className="flex flex-col">
                                                        <button onClick={() => handleMoveRank(index, 'up')} disabled={index <= 1} className="text-gray-600 hover:text-black disabled:opacity-50">▲</button>
                                                        <button onClick={() => handleMoveRank(index, 'down')} disabled={index === alliance.ranks.length - 1} className="text-gray-600 hover:text-black disabled:opacity-50">▼</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {isLeader && alliance.ranks.length < 10 && (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <h4 className="font-semibold text-lg mb-2 text-gray-900">Create New Rank</h4>
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newRankName}
                                onChange={(e) => setNewRankName(e.target.value)}
                                placeholder="New Rank Name"
                                className="w-full bg-white text-gray-900 p-2 rounded border border-amber-300"
                            />
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {allPermissions.map(perm => (
                                    <div key={perm} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={perm}
                                            checked={newRankPermissions[perm]}
                                            onChange={(e) => setNewRankPermissions(prev => ({ ...prev, [perm]: e.target.checked }))}
                                            className="mr-2"
                                        />
                                        <label htmlFor={perm} className="capitalize text-gray-900">{perm.replace(/([A-Z])/g, ' $1')}</label>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleCreateRank} className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white w-full">Create Rank</button>
                        </div>
                    </div>
                )}
                
                {message && <p className="text-amber-800 mt-2 text-sm text-center">{message}</p>}

                <div className="mt-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-semibold text-lg mb-2 text-gray-900">Assign Ranks</h4>
                    <ul className="space-y-2">
                        {sortedMembers.map(member => (
                            <li key={member.uid} className="flex justify-between items-center bg-white text-gray-900 p-2 rounded border border-amber-200">
                                <span>{member.username}</span>
                                <div className="flex items-center gap-2">
                                    {isLeader && member.uid !== alliance.leader.uid ? (
                                        editingMemberId === member.uid ? (
                                            <select
                                                value={member.rank}
                                                onChange={(e) => {
                                                    handleUpdateMemberRank(member.uid, e.target.value);
                                                    setEditingMemberId(null);
                                                }}
                                                onBlur={() => setEditingMemberId(null)}
                                                autoFocus
                                                className="bg-white text-gray-900 p-1 rounded text-sm border border-amber-300"
                                            >
                                                {alliance.ranks.map(rank => (
                                                    <option key={rank.id} value={rank.id}>{rank.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <button
                                                onClick={() => setEditingMemberId(member.uid)}
                                                className="text-sm text-amber-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                                            >
                                                {member.rank}
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-sm text-amber-800">{member.rank}</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceRanks;
