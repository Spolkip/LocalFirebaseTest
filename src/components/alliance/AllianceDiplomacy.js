import React, { useState, useEffect } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import TextEditor from '../shared/TextEditor';

// #comment Cache for diplomacy data to reduce reads.
const diplomacyCache = {
    alliances: null,
    allCities: null,
    timestamp: 0,
};

// #comment Local cache for alliance cities to reduce N+1 queries.
let allianceCitiesCache = {
    cities: null,
    timestamp: 0,
};

export const clearDiplomacyCache = () => {
    diplomacyCache.alliances = null;
    diplomacyCache.allCities = null;
    diplomacyCache.timestamp = 0;
    allianceCitiesCache.cities = null;
    allianceCitiesCache.timestamp = 0;
};

const AllianceDiplomacy = () => {
    const { playerAlliance, sendAllyRequest, declareEnemy, handleDiplomacyResponse, proposeTreaty } = useAlliance();
    const { worldId} = useGame();
    const [targetTag, setTargetTag] = useState('');
    const [message, setMessage] = useState('');

    // State for treaty proposals
    const [treatyTargetTag, setTreatyTargetTag] = useState('');
    const [offerType, setOfferType] = useState('resources');
    const [offerResources, setOfferResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [offerCityId, setOfferCityId] = useState('');
    const [offerAllianceAction, setOfferAllianceAction] = useState('declare_war');
    const [offerTargetAlliance, setOfferTargetAlliance] = useState('');
    const [demandType, setDemandType] = useState('resources');
    const [demandResources, setDemandResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [demandCityName, setDemandCityName] = useState('');
    const [demandAllianceAction, setDemandAllianceAction] = useState('declare_war');
    const [demandTargetAlliance, setDemandTargetAlliance] = useState('');
    const [frequency, setFrequency] = useState('once');
    const [occurrences, setOccurrences] = useState(1);
    const [treatyMessage, setTreatyMessage] = useState('');

    // Autocomplete states
    const [allAlliances, setAllAlliances] = useState([]);
    const [allCities, setAllCities] = useState([]);
    const [allAllianceCities, setAllAllianceCities] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [activeSuggestionInput, setActiveSuggestionInput] = useState(null);

    // #comment Fetch all alliances, world cities, and alliance cities for autocomplete and offers
    useEffect(() => {
        if (!worldId || !playerAlliance) return;

        const fetchData = async () => {
            const now = Date.now();
            const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

            if (now - diplomacyCache.timestamp < CACHE_DURATION && diplomacyCache.alliances && diplomacyCache.allCities) {
                setAllAlliances(diplomacyCache.alliances.filter(tag => tag !== playerAlliance.tag));
                setAllCities(diplomacyCache.allCities);
            } else {
                const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
                const alliancesSnapshot = await getDocs(alliancesRef);
                const alliances = alliancesSnapshot.docs.map(doc => doc.data().tag);
                setAllAlliances(alliances.filter(tag => tag !== playerAlliance.tag));
                diplomacyCache.alliances = alliances;

                const citiesRef = collection(db, 'worlds', worldId, 'citySlots');
                const q = query(citiesRef, where("ownerId", "!=", null));
                const citiesSnapshot = await getDocs(q);
                const cities = citiesSnapshot.docs.map(doc => ({ name: doc.data().cityName, x: doc.data().x, y: doc.data().y }));
                setAllCities(cities);
                diplomacyCache.allCities = cities;

                diplomacyCache.timestamp = now;
            }

            // #comment Use local cache for alliance cities to prevent N+1 queries on every view
            if (now - allianceCitiesCache.timestamp < CACHE_DURATION && allianceCitiesCache.cities) {
                setAllAllianceCities(allianceCitiesCache.cities);
            } else {
                // #comment Fetch cities from all members in parallel for better performance
                const memberPromises = playerAlliance.members.map(async (member) => {
                    const citiesRef = collection(db, `users/${member.uid}/games`, worldId, 'cities');
                    const snapshot = await getDocs(citiesRef);
                    return snapshot.docs.map(doc => ({ owner: member.username, ...doc.data() }));
                });
        
                const citiesByMember = await Promise.all(memberPromises);
                const cities = citiesByMember.flat();

                setAllAllianceCities(cities);
                allianceCitiesCache.cities = cities;
                allianceCitiesCache.timestamp = now;
            }
        };

        fetchData();
    }, [worldId, playerAlliance]);


    const handleInputChange = (value, fieldSetter, fieldName) => {
        fieldSetter(value);
        setActiveSuggestionInput(fieldName);

        let sourceData = [];
        if (fieldName === 'demandCity') {
            sourceData = allCities.map(c => c.name);
        } else {

            sourceData = allAlliances;
        }

        if (value.length > 0 && sourceData.length > 0) {
            const filteredSuggestions = sourceData.filter(item =>
                item.toLowerCase().startsWith(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions.slice(0, 5));
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (value) => {
        if (activeSuggestionInput === 'targetTag') setTargetTag(value);
        if (activeSuggestionInput === 'treatyTargetTag') setTreatyTargetTag(value);
        if (activeSuggestionInput === 'offerTargetAlliance') setOfferTargetAlliance(value);
        if (activeSuggestionInput === 'demandTargetAlliance') setDemandTargetAlliance(value);
        if (activeSuggestionInput === 'demandCity') setDemandCityName(value);
        setSuggestions([]);
        setActiveSuggestionInput(null);
    };

    const handleRequest = async () => {
        if (!targetTag.trim()) return;
        setMessage('');
        try {
            await sendAllyRequest(targetTag.trim().toUpperCase());
            setMessage(`Ally request sent to [${targetTag.trim().toUpperCase()}]`);
            setTargetTag('');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const handleDeclareEnemy = async () => {
        if (!targetTag.trim()) return;
        setMessage('');
        try {
            await declareEnemy(targetTag.trim().toUpperCase());
            setMessage(`[${targetTag.trim().toUpperCase()}] has been declared as an enemy.`);
            setTargetTag('');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const handleResponse = async (targetAllianceId, action) => {
        setMessage('');
        try {
            await handleDiplomacyResponse(targetAllianceId, action);
            setMessage('Diplomatic status updated.');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const handleProposeTreaty = async () => {
        if (!treatyTargetTag.trim()) {
            setMessage('Please enter a target alliance tag for the treaty.');
            return;
        }
        setMessage('');
        try {
            let offerPayload;
            if (offerType === 'resources') {
                offerPayload = { type: 'resources', data: offerResources };
            } else if (offerType === 'city') {
                if (!offerCityId) throw new Error("You must select a city to offer.");
                const offeredCity = allAllianceCities.find(c => c.id === offerCityId);
                if (!offeredCity) throw new Error("Offered city not found in alliance.");
                offerPayload = { type: 'city', cityId: offerCityId, cityName: offeredCity.cityName, coords: `${offeredCity.x},${offeredCity.y}` };
            } else {
                offerPayload = { type: 'alliance_action', action: offerAllianceAction, target: offerTargetAlliance };
            }

            let demandPayload;
            if (demandType === 'resources') {
                demandPayload = { type: 'resources', data: demandResources };
            } else if (demandType === 'city') {
                const demandedCity = allCities.find(c => c.name.toLowerCase() === demandCityName.toLowerCase());
                if (!demandedCity) throw new Error("The demanded city does not exist or could not be found.");
                demandPayload = { type: 'city', coords: `${demandedCity.x},${demandedCity.y}`, cityName: demandedCity.name };
            } else {
                demandPayload = { type: 'alliance_action', action: demandAllianceAction, target: demandTargetAlliance };
            }

            const details = {
                offer: offerPayload,
                demand: demandPayload,
                frequency,
                occurrences: frequency === 'once' ? 1 : occurrences,
                message: treatyMessage,
            };
            await proposeTreaty(treatyTargetTag.trim().toUpperCase(), details);
            setMessage(`Treaty proposed to [${treatyTargetTag.trim().toUpperCase()}]`);
            setTreatyTargetTag('');
        } catch (error) {
            setMessage(`Failed to propose treaty: ${error.message}`);
        }
    };

    const diplomacy = playerAlliance.diplomacy || {};
    const requests = diplomacy.requests || [];
    const allies = diplomacy.allies || [];
    const enemies = diplomacy.enemies || [];

    const allianceActionNeedsTarget = (action) => {
        return ['declare_war', 'form_pact', 'coordinated_attack'].includes(action);
    };

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Diplomacy</h3>
                <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Make a Declaration</h4>
                    <div className="flex gap-2 autocomplete-suggestions-container">
                        <input
                            type="text"
                            value={targetTag}
                            onChange={(e) => handleInputChange(e.target.value, setTargetTag, 'targetTag')}
                            placeholder="Enter Alliance Tag"
                            className="w-full bg-white text-gray-900 p-2 rounded border border-amber-300"
                            maxLength="5"
                            autoComplete="off"
                        />
                        {suggestions.length > 0 && activeSuggestionInput === 'targetTag' && (
                            <ul className="autocomplete-suggestions-list light">
                                {suggestions.map(tag => (
                                    <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button onClick={handleRequest} className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white">Ally Request</button>
                        <button onClick={handleDeclareEnemy} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white">Declare Enemy</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Incoming Requests</h4>
                        <ul className="space-y-2">
                            {requests.length > 0 ? requests.map(req => (
                                <li key={req.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{req.name} [{req.tag}]</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleResponse(req.id, 'accept')} className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1">✓</button>
                                        <button onClick={() => handleResponse(req.id, 'reject')} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1">✗</button>
                                    </div>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Allies</h4>
                        <ul className="space-y-2">
                            {allies.length > 0 ? allies.map(ally => (
                                <li key={ally.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{ally.name} [{ally.tag}]</span>
                                    <button onClick={() => handleResponse(ally.id, 'removeAlly')} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1">Remove</button>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Enemies</h4>
                        <ul className="space-y-2">
                            {enemies.length > 0 ? enemies.map(enemy => (
                                <li key={enemy.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{enemy.name} [{enemy.tag}]</span>
                                    <button onClick={() => handleResponse(enemy.id, 'removeEnemy')} className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1">Remove</button>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Treaties</h3>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Propose a Treaty</h4>
                    <div className="space-y-3">
                        <div className="autocomplete-suggestions-container">
                            <input type="text" value={treatyTargetTag} onChange={(e) => handleInputChange(e.target.value, setTreatyTargetTag, 'treatyTargetTag')} placeholder="Target Alliance Tag" className="w-full p-2 rounded border border-amber-300" autoComplete="off" />
                            {suggestions.length > 0 && activeSuggestionInput === 'treatyTargetTag' && (
                                <ul className="autocomplete-suggestions-list light">
                                    {suggestions.map(tag => (
                                        <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                            {tag}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="border p-2 rounded">
                            <h5 className="font-semibold">You Offer:</h5>
                            <select value={offerType} onChange={(e) => setOfferType(e.target.value)}>
                                <option value="resources">Resources</option>
                                <option value="alliance_action">Alliance Action</option>
                                <option value="city">City</option>
                            </select>
                            {offerType === 'resources' ? (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <input type="number" value={offerResources.wood} onChange={(e) => setOfferResources(prev => ({...prev, wood: parseInt(e.target.value) || 0}))} placeholder="Wood" />
                                    <input type="number" value={offerResources.stone} onChange={(e) => setOfferResources(prev => ({...prev, stone: parseInt(e.target.value) || 0}))} placeholder="Stone" />
                                    <input type="number" value={offerResources.silver} onChange={(e) => setOfferResources(prev => ({...prev, silver: parseInt(e.target.value) || 0}))} placeholder="Silver" />
                                </div>
                            ) : offerType === 'city' ? (
                                <select value={offerCityId} onChange={(e) => setOfferCityId(e.target.value)} className="w-full p-2 rounded border border-amber-300 mt-2">
                                    <option value="">Select a city to offer</option>
                                    {Object.values(allAllianceCities.reduce((acc, city) => {
                                        (acc[city.owner] = acc[city.owner] || []).push(city);
                                        return acc;
                                    }, {})).map((cities, index) => (
                                        <optgroup label={cities[0].owner} key={index}>
                                            {cities.map(city => (
                                                <option key={city.id} value={city.id}>{city.cityName} ({city.x},{city.y})</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mt-2 autocomplete-suggestions-container">
                                    <select value={offerAllianceAction} onChange={(e) => setOfferAllianceAction(e.target.value)}>
                                        <option value="declare_war">Declare War On</option>
                                        <option value="form_pact">Form Pact With</option>
                                        <option value="non_aggression">Non-Aggression Pact</option>
                                        <option value="coordinated_attack">Coordinated Attack On</option>
                                        <option value="offer_peace">Offer Peace</option>
                                    </select>
                                    {allianceActionNeedsTarget(offerAllianceAction) && (
                                        <input type="text" value={offerTargetAlliance} onChange={(e) => handleInputChange(e.target.value, setOfferTargetAlliance, 'offerTargetAlliance')} placeholder="Target Alliance Tag" autoComplete="off"/>
                                    )}
                                    {suggestions.length > 0 && activeSuggestionInput === 'offerTargetAlliance' && (
                                        <ul className="autocomplete-suggestions-list light">
                                            {suggestions.map(tag => (
                                                <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border p-2 rounded">
                            <h5 className="font-semibold">You Demand:</h5>
                            <select value={demandType} onChange={(e) => setDemandType(e.target.value)}>
                                <option value="resources">Resources</option>
                                <option value="alliance_action">Alliance Action</option>
                                <option value="city">City</option>
                            </select>
                            {demandType === 'resources' ? (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <input type="number" value={demandResources.wood} onChange={(e) => setDemandResources(prev => ({...prev, wood: parseInt(e.target.value) || 0}))} placeholder="Wood" />
                                    <input type="number" value={demandResources.stone} onChange={(e) => setDemandResources(prev => ({...prev, stone: parseInt(e.target.value) || 0}))} placeholder="Stone" />
                                    <input type="number" value={demandResources.silver} onChange={(e) => setDemandResources(prev => ({...prev, silver: parseInt(e.target.value) || 0}))} placeholder="Silver" />
                                </div>
                            ) : demandType === 'city' ? (
                                <div className="autocomplete-suggestions-container mt-2">
                                    <input
                                        type="text"
                                        value={demandCityName}
                                        onChange={(e) => handleInputChange(e.target.value, setDemandCityName, 'demandCity')}
                                        placeholder="Enter City Name"
                                        className="w-full p-2 rounded border border-amber-300"
                                        autoComplete="off"
                                    />
                                    {suggestions.length > 0 && activeSuggestionInput === 'demandCity' && (
                                        <ul className="autocomplete-suggestions-list light">
                                            {suggestions.map(name => (
                                                <li key={name} onClick={() => handleSuggestionClick(name)}>
                                                    {name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mt-2 autocomplete-suggestions-container">
                                    <select value={demandAllianceAction} onChange={(e) => setDemandAllianceAction(e.target.value)}>
                                        <option value="declare_war">Declare War On</option>
                                        <option value="form_pact">Form Pact With</option>
                                        <option value="non_aggression">Non-Aggression Pact</option>
                                        <option value="coordinated_attack">Coordinated Attack On</option>
                                        <option value="demand_surrender">Demand Surrender</option>
                                    </select>
                                    {allianceActionNeedsTarget(demandAllianceAction) && (
                                        <input type="text" value={demandTargetAlliance} onChange={(e) => handleInputChange(e.target.value, setDemandTargetAlliance, 'demandTargetAlliance')} placeholder="Target Alliance Tag" autoComplete="off"/>
                                    )}
                                    {suggestions.length > 0 && activeSuggestionInput === 'demandTargetAlliance' && (
                                        <ul className="autocomplete-suggestions-list light">
                                            {suggestions.map(tag => (
                                                <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                                <option value="once">Once</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                            {frequency !== 'once' && (
                                <input type="number" value={occurrences} onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)} placeholder="Occurrences" />
                            )}
                        </div>
                        <TextEditor value={treatyMessage} onChange={setTreatyMessage} />
                        <button onClick={handleProposeTreaty} className="btn btn-confirm w-full">Propose Treaty</button>
                    </div>
                </div>
            </div>
            {message && <p className="text-sm mt-2 text-amber-800">{message}</p>}
        </div>
    );
};

export default AllianceDiplomacy;