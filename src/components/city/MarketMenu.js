// src/components/city/MarketMenu.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, query,onSnapshot, serverTimestamp, doc, runTransaction, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import './MarketMenu.css';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const resourceImages = {
    wood: woodImage,
    stone: stoneImage,
    silver: silverImage,
};

const MarketMenu = ({ onClose, cityGameState, worldId, marketCapacity }) => {
    const { currentUser, userProfile } = useAuth();
    const { activeCityId } = useGame(); // #comment Get activeCityId to reference the correct city document
    const [activeTab, setActiveTab] = useState('marketplace');
    const [trades, setTrades] = useState([]);
    const [myTrades, setMyTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for creating a new trade
    const [offerResource, setOfferResource] = useState('wood');
    const [offerAmount, setOfferAmount] = useState('');
    const [demandResource, setDemandResource] = useState('stone');
    const [demandAmount, setDemandAmount] = useState('');
    
    const marketRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 800) / 2,
        y: (window.innerHeight - 600) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('market-header') || e.target.parentElement.classList.contains('market-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);


    // #comment fetch trade offers from firestore
    useEffect(() => {
        if (!worldId) return;
        setLoading(true);
        const tradesRef = collection(db, 'worlds', worldId, 'trades');
        const q = query(tradesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allTrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTrades(allTrades.filter(t => t.playerId !== currentUser.uid));
            setMyTrades(allTrades.filter(t => t.playerId === currentUser.uid));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching trades:", err);
            setError("Could not load market data.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [worldId, currentUser.uid]);

    // #comment handle creation of a new trade offer
    const handleCreateTrade = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setError('');
        const offerAmountNum = parseInt(offerAmount, 10);
        const demandAmountNum = parseInt(demandAmount, 10);

        if (offerResource === demandResource) {
            setError("You cannot trade a resource for itself.");
            return;
        }
        if (!offerAmountNum || !demandAmountNum || offerAmountNum <= 0 || demandAmountNum <= 0) {
            setError("Please enter valid, positive amounts for the trade.");
            return;
        }
        if (cityGameState.resources[offerResource] < offerAmountNum) {
            setError(`You do not have enough ${offerResource} to make this offer.`);
            return;
        }
        if (offerAmountNum > marketCapacity) {
            setError(`You cannot offer more than your market capacity of ${marketCapacity}.`);
            return;
        }

        setIsSubmitting(true);
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const tradesRef = collection(db, 'worlds', worldId, 'trades');

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");

                const currentResources = cityDoc.data().resources;
                if (currentResources[offerResource] < offerAmountNum) {
                    throw new Error(`Not enough ${offerResource}.`);
                }

                const newResources = {
                    ...currentResources,
                    [offerResource]: currentResources[offerResource] - offerAmountNum,
                };
                transaction.update(cityDocRef, { resources: newResources });

                const newTrade = {
                    playerId: currentUser.uid,
                    playerName: userProfile.username,
                    originCityId: activeCityId, // #comment Store which city made the offer
                    offer: { resource: offerResource, amount: offerAmountNum },
                    demand: { resource: demandResource, amount: demandAmountNum },
                    createdAt: serverTimestamp(),
                };
                transaction.set(doc(tradesRef), newTrade);
            });

            setOfferAmount('');
            setDemandAmount('');
            setActiveTab('my-trades');
            setTimeout(() => setIsSubmitting(false), 3000); // 3-second cooldown
        } catch (error) {
            console.error("Error creating trade:", error);
            setError(`Failed to create trade: ${error.message}`);
            setIsSubmitting(false);
        }
    };

    // #comment handle accepting a trade from another player
    const handleAcceptTrade = async (trade) => {
        setError('');
        if (cityGameState.resources[trade.demand.resource] < trade.demand.amount) {
            setError(`You don't have enough ${trade.demand.resource} to accept this trade.`);
            return;
        }

        const tradeRef = doc(db, 'worlds', worldId, 'trades', trade.id);
        const myCityRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const theirCityRef = doc(db, `users/${trade.playerId}/games`, worldId, 'cities', trade.originCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const tradeDoc = await transaction.get(tradeRef);
                if (!tradeDoc.exists()) throw new Error("This trade is no longer available.");

                const myCityDoc = await transaction.get(myCityRef);
                const theirCityDoc = await transaction.get(theirCityRef);
                if (!myCityDoc.exists() || !theirCityDoc.exists()) throw new Error("Could not find player data for this trade.");

                const myResources = myCityDoc.data().resources;
                const theirResources = theirCityDoc.data().resources;

                if (myResources[trade.demand.resource] < trade.demand.amount) {
                    throw new Error(`You do not have enough ${trade.demand.resource}.`);
                }

                // Update my resources
                const myNewResources = { ...myResources };
                myNewResources[trade.demand.resource] -= trade.demand.amount;
                myNewResources[trade.offer.resource] = (myNewResources[trade.offer.resource] || 0) + trade.offer.amount;
                transaction.update(myCityRef, { resources: myNewResources });

                // Update their resources
                const theirNewResources = { ...theirResources };
                theirNewResources[trade.demand.resource] = (theirNewResources[trade.demand.resource] || 0) + trade.demand.amount;
                transaction.update(theirCityRef, { resources: theirNewResources });

                // Delete the trade
                transaction.delete(tradeRef);
            });
        } catch (error) {
            console.error("Error accepting trade:", error);
            setError(`Failed to accept trade: ${error.message}`);
        }
    };

    // #comment handle canceling one of your own trades
    const handleCancelTrade = async (trade) => {
        setError('');
        const tradeRef = doc(db, 'worlds', worldId, 'trades', trade.id);
        const myCityRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', trade.originCityId);

        try {
            await runTransaction(db, async (transaction) => {
                const tradeDoc = await transaction.get(tradeRef);
                if (!tradeDoc.exists()) throw new Error("This trade no longer exists.");

                const myCityDoc = await transaction.get(myCityRef);
                if (!myCityDoc.exists()) throw new Error("Your city data could not be found.");

                const myResources = myCityDoc.data().resources;
                const myNewResources = { ...myResources };
                myNewResources[trade.offer.resource] = (myNewResources[trade.offer.resource] || 0) + trade.offer.amount;

                transaction.update(myCityRef, { resources: myNewResources });
                transaction.delete(tradeRef);
            });
        } catch (error) {
            console.error("Error canceling trade:", error);
            setError(`Failed to cancel trade: ${error.message}`);
        }
    };

    const renderTrades = (tradeList, isMyTrade) => {
        if (loading) return <p>Loading trades...</p>;
        if (tradeList.length === 0) return <p className="text-center p-4">No trades found.</p>;

        return (
            <table className="market-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Offering</th>
                        <th>Demanding</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {tradeList.map(trade => {
                        const canAfford = cityGameState.resources[trade.demand.resource] >= trade.demand.amount;
                        return (
                            <tr key={trade.id}>
                                <td>{trade.playerName}</td>
                                <td className="resource-cell">
                                    <img src={resourceImages[trade.offer.resource]} alt={trade.offer.resource} />
                                    {trade.offer.amount.toLocaleString()}
                                </td>
                                <td className="resource-cell">
                                    <img src={resourceImages[trade.demand.resource]} alt={trade.demand.resource} />
                                    {trade.demand.amount.toLocaleString()}
                                </td>
                                <td>
                                    {isMyTrade ? (
                                        <button onClick={() => handleCancelTrade(trade)} className="market-btn cancel-btn">Cancel</button>
                                    ) : (
                                        <button onClick={() => handleAcceptTrade(trade)} disabled={!canAfford} className="market-btn accept-btn">
                                            {canAfford ? 'Accept' : 'Too Costly'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div
                ref={marketRef}
                className="market-container"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="market-header">
                    <h2>Marketplace</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="market-tabs">
                    <button onClick={() => setActiveTab('marketplace')} className={activeTab === 'marketplace' ? 'active' : ''}>Marketplace</button>
                    <button onClick={() => setActiveTab('my-trades')} className={activeTab === 'my-trades' ? 'active' : ''}>My Trades</button>
                    <button onClick={() => setActiveTab('create')} className={activeTab === 'create' ? 'active' : ''}>Create Trade</button>
                </div>
                <div className="market-content">
                    {error && <p className="error-message">{error}</p>}
                    {activeTab === 'marketplace' && renderTrades(trades, false)}
                    {activeTab === 'my-trades' && renderTrades(myTrades, true)}
                    {activeTab === 'create' && (
                        <form onSubmit={handleCreateTrade} className="create-trade-form">
                            <div className="trade-inputs">
                                <div className="trade-group">
                                    <label>You Offer</label>
                                    <select value={offerResource} onChange={e => setOfferResource(e.target.value)}>
                                        <option value="wood">Wood</option>
                                        <option value="stone">Stone</option>
                                        <option value="silver">Silver</option>
                                    </select>
                                    <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="Amount" />
                                    <p>Your Wood: {Math.floor(cityGameState.resources.wood)}</p>
                                </div>
                                <div className="trade-group">
                                    <label>You Demand</label>
                                    <select value={demandResource} onChange={e => setDemandResource(e.target.value)}>
                                        <option value="wood">Wood</option>
                                        <option value="stone">Stone</option>
                                        <option value="silver">Silver</option>
                                    </select>
                                    <input type="number" value={demandAmount} onChange={e => setDemandAmount(e.target.value)} placeholder="Amount" />
                                    <p>Your Stone: {Math.floor(cityGameState.resources.stone)}</p>
                                </div>
                            </div>
                             <p className="capacity-info">Your Silver: {Math.floor(cityGameState.resources.silver)} | Market Capacity: {marketCapacity}</p>
                            <button type="submit" className="market-btn create-btn" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Offer'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarketMenu;
