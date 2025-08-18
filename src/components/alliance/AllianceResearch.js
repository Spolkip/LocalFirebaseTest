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

     return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-2 border-b border-amber-300 pb-2">Alliance Research</h3>
            {message && <p className="text-center text-amber-800 mb-4">{message}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(allianceResearch).map(([id, research]) => {
                    const level = playerAlliance.research[id]?.level || 0;
                    const progress = playerAlliance.research[id]?.progress || {};
                    const cost = {
                        wood: Math.floor(research.baseCost.wood * Math.pow(research.costMultiplier, level)),
                        stone: Math.floor(research.baseCost.stone * Math.pow(research.costMultiplier, level)),
                        silver: Math.floor(research.baseCost.silver * Math.pow(research.costMultiplier, level)),
                    };
                    const isRecommended = playerAlliance.recommendedResearch === id;

                    return (
                        <div 
                            key={id} 
                            className={`p-4 rounded-lg transition-all border ${
                                isRecommended 
                                    ? 'bg-yellow-300 text-gray-900 border-yellow-400 shadow-md' 
                                    : 'bg-amber-50 text-gray-900 border-amber-200'
                            }`}
                        >
                            <h4 className="font-bold">{research.name} (Level {level})</h4>
                            <p className="text-sm text-amber-800">{research.description}</p>
                            {level < research.maxLevel ? (
                                <>
                                    <div className="my-2">
                                        <p>Progress:</p>
                                        <p className="text-xs">Wood: {progress.wood || 0} / {cost.wood}</p>
                                        <p className="text-xs">Stone: {progress.stone || 0} / {cost.stone}</p>
                                        <p className="text-xs">Silver: {progress.silver || 0} / {cost.silver}</p>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => setSelectedResearch(id)} className="btn btn-sm btn-primary">Donate</button>
                                        {canRecommend && (
                                            <button onClick={() => handleRecommend(id)} className="btn btn-sm btn-secondary">
                                                {isRecommended ? 'Recommended' : 'Recommend'}
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-green-400 font-bold mt-2">Max Level Reached</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedResearch && (
                <div className="mt-4 p-4 bg-gray-800 rounded">
                    <h4 className="font-bold">Donate to {allianceResearch[selectedResearch].name}</h4>
                    <div className="flex gap-2 my-2">
                        <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Wood" />
                        <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Stone" />
                        <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Silver" />
                    </div>
                    <button onClick={() => handleDonate(selectedResearch)} className="btn btn-confirm">Confirm Donation</button>
                    <button onClick={() => setSelectedResearch(null)} className="btn btn-secondary ml-2">Cancel</button>
                </div>
            )}
        </div>
    );
};

export default AllianceResearch;
