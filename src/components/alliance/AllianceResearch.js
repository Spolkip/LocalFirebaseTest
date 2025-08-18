import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';
import allianceResearch from '../../gameData/allianceResearch.json';

const AllianceResearch = () => {
    const { playerAlliance, donateToAllianceResearch, recommendAllianceResearch } = useAlliance();
    const { currentUser } = useAuth();
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [selectedResearch, setSelectedResearch] = useState(null);
    const [message, setMessage] = useState('');

    const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
    const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
    const canRecommend = rank?.permissions?.recommendResearch;

    const handleDonationChange = (e) => {
        setDonation({ ...donation, [e.target.name]: parseInt(e.target.value) || 0 });
    };

    const handleDonate = (researchId) => {
        donateToAllianceResearch(researchId, donation);
        setDonation({ wood: 0, stone: 0, silver: 0 });
    };

    const handleRecommend = async (researchId) => {
        try {
            await recommendAllianceResearch(researchId);
            setMessage('Research recommendation updated!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // #comment Toggles the donation form for a research item
    const handleSelectResearch = (id) => {
        if (selectedResearch === id) {
            setSelectedResearch(null);
        } else {
            setSelectedResearch(id);
            setDonation({ wood: 0, stone: 0, silver: 0 }); // Reset donation on new selection
        }
    };

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-2 border-b border-amber-300 pb-2">Alliance Research</h3>
            {message && <p className="text-center text-amber-800 mb-4">{message}</p>}
            <div className="grid grid-cols-1 gap-4">
                {Object.entries(allianceResearch).map(([id, research]) => {
                    const level = playerAlliance.research[id]?.level || 0;
                    const progress = playerAlliance.research[id]?.progress || { wood: 0, stone: 0, silver: 0 };
                    const cost = {
                        wood: Math.floor(research.baseCost.wood * Math.pow(research.costMultiplier, level)),
                        stone: Math.floor(research.baseCost.stone * Math.pow(research.costMultiplier, level)),
                        silver: Math.floor(research.baseCost.silver * Math.pow(research.costMultiplier, level)),
                    };
                    const isRecommended = playerAlliance.recommendedResearch === id;
                    const isSelected = selectedResearch === id;

                    return (
                        <div
                            key={id}
                            className={`p-4 rounded-lg transition-all border ${
                                isRecommended
                                    ? 'bg-yellow-200 text-gray-900 border-yellow-400 shadow-md'
                                    : 'bg-amber-50 text-gray-900 border-amber-200'
                            }`}
                        >
                            <div className="flex flex-wrap md:flex-nowrap gap-4">
                                <div className="flex-grow">
                                    <h4 className="font-bold">{research.name} (Level {level})</h4>
                                    <p className="text-sm text-amber-800">{research.description}</p>
                                    {level < research.maxLevel ? (
                                        <>
                                            <div className="my-2 grid grid-cols-3 gap-x-2">
                                                <div>
                                                    <p className="font-semibold">Wood</p>
                                                    <p className="text-xs">{progress.wood.toLocaleString()} / {cost.wood.toLocaleString()}</p>
                                                    <div className="w-full bg-gray-300 rounded-full h-1.5 mt-1"><div className="bg-yellow-600 h-1.5 rounded-full" style={{width: `${Math.min(100, (progress.wood / cost.wood) * 100)}%`}}></div></div>
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Stone</p>
                                                    <p className="text-xs">{progress.stone.toLocaleString()} / {cost.stone.toLocaleString()}</p>
                                                    <div className="w-full bg-gray-300 rounded-full h-1.5 mt-1"><div className="bg-gray-500 h-1.5 rounded-full" style={{width: `${Math.min(100, (progress.stone / cost.stone) * 100)}%`}}></div></div>
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Silver</p>
                                                    <p className="text-xs">{progress.silver.toLocaleString()} / {cost.silver.toLocaleString()}</p>
                                                    <div className="w-full bg-gray-300 rounded-full h-1.5 mt-1"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${Math.min(100, (progress.silver / cost.silver) * 100)}%`}}></div></div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => handleSelectResearch(id)} className="btn btn-sm btn-primary">{isSelected ? 'Close' : 'Donate'}</button>
                                                {canRecommend && (
                                                    <button onClick={() => handleRecommend(id)} className={`btn btn-sm btn-secondary ${isRecommended ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}>
                                                        {isRecommended ? 'Recommended' : 'Recommend'}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-green-600 font-bold mt-2">Max Level Reached</p>
                                    )}
                                </div>

                                {isSelected && (
                                    <div className="w-full md:w-64 flex-shrink-0 bg-amber-100 p-3 rounded-lg border border-amber-300">
                                        <h4 className="font-bold text-center mb-2">Donate to {research.name}</h4>
                                        <div className="flex flex-col gap-2">
                                            <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full bg-white p-1 rounded border border-amber-300" placeholder="Wood" />
                                            <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full bg-white p-1 rounded border border-amber-300" placeholder="Stone" />
                                            <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full bg-white p-1 rounded border border-amber-300" placeholder="Silver" />
                                        </div>
                                        <button onClick={() => handleDonate(id)} className="btn btn-confirm w-full mt-2">Confirm Donation</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AllianceResearch;
