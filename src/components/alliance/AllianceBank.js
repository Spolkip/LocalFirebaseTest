// src/components/alliance/AllianceBank.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import allianceResearch from '../../gameData/allianceResearch.json';

const AllianceBank = () => {
    const { playerAlliance, donateToBank, distributeFromBank } = useAlliance();
    const { currentUser } = useAuth();
    const { gameState, worldId } = useGame();
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [distribution, setDistribution] = useState({ wood: 0, stone: 0, silver: 0 });
    const [targetMemberName, setTargetMemberName] = useState('');
    const [targetMemberUid, setTargetMemberUid] = useState('');
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState('');

    // Autocomplete states
    const [suggestions, setSuggestions] = useState([]);

    const bank = playerAlliance.bank || { wood: 0, stone: 0, silver: 0 };

    const bankCapacity = useMemo(() => {
        if (!playerAlliance) return 0;
        const baseCapacity = 1000000;
        const researchLevel = playerAlliance.research?.reinforced_vaults?.level || 0;
        const researchBonus = (allianceResearch.reinforced_vaults?.effect.value || 0) * researchLevel;
        return baseCapacity + researchBonus;
    }, [playerAlliance]);

    const memberRankData = useMemo(() => {
        if (!playerAlliance || !currentUser) return null;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return null;
        return playerAlliance.ranks.find(r => r.id === member.rank);
    }, [playerAlliance, currentUser]);

    const canManageBank = memberRankData?.permissions?.manageBank;

    useEffect(() => {
        if (!playerAlliance || !worldId) return;
        const logsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'bank_logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [playerAlliance, worldId]);

    const handleDonationChange = (e) => {
        const { name, value } = e.target;
        const amount = Math.max(0, Math.min(gameState.resources[name] || 0, parseInt(value) || 0));
        setDonation(prev => ({ ...prev, [name]: amount }));
    };

    const handleDistributionChange = (e) => {
        const { name, value } = e.target;
        const amount = Math.max(0, Math.min(bank[name] || 0, parseInt(value) || 0));
        setDistribution(prev => ({ ...prev, [name]: amount }));
    };

    const handleDonate = async () => {
        setMessage('');
        try {
            await donateToBank(donation);
            setMessage('Donation successful!');
            setDonation({ wood: 0, stone: 0, silver: 0 });
        } catch (error) {
            setMessage(`Donation failed: ${error.message}`);
        }
    };

    const handleDistribute = async () => {
        setMessage('');
        if (!targetMemberUid) {
            setMessage('Please select a valid member to distribute resources to.');
            return;
        }
        try {
            await distributeFromBank(targetMemberUid, distribution);
            setMessage('Distribution successful!');
            setDistribution({ wood: 0, stone: 0, silver: 0 });
            setTargetMemberName('');
            setTargetMemberUid('');
        } catch (error) {
            setMessage(`Distribution failed: ${error.message}`);
        }
    };

    const handleTargetMemberChange = (e) => {
        const value = e.target.value;
        setTargetMemberName(value);
        setTargetMemberUid(''); // Clear UID when name changes
        if (value.length > 0) {
            const filteredSuggestions = playerAlliance.members
                .filter(member => member.uid !== currentUser.uid)
                .filter(member => member.username.toLowerCase().startsWith(value.toLowerCase()));
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (member) => {
        setTargetMemberName(member.username);
        setTargetMemberUid(member.uid);
        setSuggestions([]);
    };

    const setDistributionPercentage = (resource, percentage) => {
        const amount = Math.floor((bank[resource] || 0) * percentage);
        setDistribution(prev => ({ ...prev, [resource]: amount }));
    };

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Alliance Bank</h3>
            {message && <p className="text-center text-amber-800 mb-4">{message}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-lg mb-2">Bank Holdings</h4>
                    <p className="text-sm text-gray-600">Capacity: {bankCapacity.toLocaleString()} per resource</p>
                    <p>Wood: {(bank.wood || 0).toLocaleString()}</p>
                    <p>Stone: {(bank.stone || 0).toLocaleString()}</p>
                    <p>Silver: {(bank.silver || 0).toLocaleString()}</p>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-lg mb-2">Donate Resources</h4>
                    <p className="text-xs text-gray-500 mb-2">5 min cooldown | 50,000 daily limit</p>
                    <div className="space-y-2">
                        <div>
                            <label>Wood (Your: {Math.floor(gameState.resources.wood || 0)})</label>
                            <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <div>
                            <label>Stone (Your: {Math.floor(gameState.resources.stone || 0)})</label>
                            <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <div>
                            <label>Silver (Your: {Math.floor(gameState.resources.silver || 0)})</label>
                            <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <button onClick={handleDonate} className="btn btn-confirm w-full">Donate</button>
                    </div>
                </div>

                {canManageBank && (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 md:col-span-2">
                        <h4 className="font-bold text-lg mb-2">Distribute Resources</h4>
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                            <div className="md:col-span-2 autocomplete-suggestions-container">
                                <label>Member</label>
                                <input
                                    type="text"
                                    value={targetMemberName}
                                    onChange={handleTargetMemberChange}
                                    placeholder="Player Username"
                                    className="w-full p-1 rounded border border-amber-300"
                                    autoComplete="off"
                                />
                                {suggestions.length > 0 && (
                                    <ul className="autocomplete-suggestions-list light">
                                        {suggestions.map(member => (
                                            <li key={member.uid} onClick={() => handleSuggestionClick(member)}>
                                                {member.username}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="md:col-span-5 grid grid-cols-3 gap-x-4">
                                <div>
                                    <label>Wood</label>
                                    <input type="number" name="wood" value={distribution.wood} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300 mb-1" />
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setDistributionPercentage('wood', 0.25)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">25%</button>
                                        <button onClick={() => setDistributionPercentage('wood', 0.50)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">50%</button>
                                        <button onClick={() => setDistributionPercentage('wood', 1)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">Max</button>
                                    </div>
                                </div>
                                <div>
                                    <label>Stone</label>
                                    <input type="number" name="stone" value={distribution.stone} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300 mb-1" />
                                     <div className="flex items-center gap-1">
                                        <button onClick={() => setDistributionPercentage('stone', 0.25)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">25%</button>
                                        <button onClick={() => setDistributionPercentage('stone', 0.50)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">50%</button>
                                        <button onClick={() => setDistributionPercentage('stone', 1)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">Max</button>
                                    </div>
                                </div>
                                <div>
                                    <label>Silver</label>
                                    <input type="number" name="silver" value={distribution.silver} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300 mb-1" />
                                     <div className="flex items-center gap-1">
                                        <button onClick={() => setDistributionPercentage('silver', 0.25)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">25%</button>
                                        <button onClick={() => setDistributionPercentage('silver', 0.50)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">50%</button>
                                        <button onClick={() => setDistributionPercentage('silver', 1)} className="btn btn-secondary text-xs px-1 py-0.5 flex-1">Max</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleDistribute} className="btn btn-primary w-full mt-4">Distribute</button>
                    </div>
                )}

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 md:col-span-2">
                    <h4 className="font-bold text-lg mb-2">Transaction History</h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {logs.map(log => (
                            <li key={log.id} className="text-sm p-2 bg-white rounded border border-amber-200">
                                {log.type === 'donation' ? (
                                    <span><strong>{log.user}</strong> donated {Object.entries(log.resources).filter(([,a])=>a>0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ')}.</span>
                                ) : (
                                    <span><strong>{log.from}</strong> sent {Object.entries(log.resources).filter(([,a])=>a>0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ')} to <strong>{log.to}</strong>.</span>
                                )}
                                <span className="text-xs text-gray-500 float-right">{log.timestamp?.toDate().toLocaleTimeString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceBank;
