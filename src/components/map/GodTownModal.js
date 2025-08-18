// src/components/map/GodTownModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import PuzzleRenderer from '../puzzles/PuzzleRenderer';
import Countdown from './Countdown';
import TroopDisplay from '../TroopDisplay'; // Import TroopDisplay

const GodTownModal = ({ townId, onClose, onAttack }) => {
    const { currentUser } = useAuth();
    const { worldId } = useGame();
    const [townData, setTownData] = useState(null);
    const [playerProgress, setPlayerProgress] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!worldId || !townId || !currentUser) {
            setLoading(false);
            return;
        }

        // #comment Use onSnapshot for real-time updates for town data
        const townRef = doc(db, 'worlds', worldId, 'godTowns', townId);
        const unsubscribeTown = onSnapshot(townRef, (townSnap) => {
            if (townSnap.exists()) {
                setTownData({ id: townSnap.id, ...townSnap.data() });
            } else {
                onClose(); // Close if the town disappears
            }
        });

        // #comment Use onSnapshot for real-time updates for player progress
        const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', townId, 'playerProgress', currentUser.uid);
        const unsubscribeProgress = onSnapshot(playerProgressRef, async (progressSnap) => {
            if (progressSnap.exists()) {
                setPlayerProgress(progressSnap.data());
            } else {
                // If progress doc doesn't exist, create it.
                const newProgress = { puzzleSolved: false, damageDealt: 0 };
                try {
                    await setDoc(playerProgressRef, newProgress);
                    setPlayerProgress(newProgress);
                } catch (error) {
                    console.error("Failed to create player progress doc:", error);
                }
            }
        });

        return () => {
            unsubscribeTown();
            unsubscribeProgress();
        };
    }, [worldId, townId, currentUser, onClose]);

    // #comment Determine loading state based on whether data has arrived.
    useEffect(() => {
        if (townData !== null && playerProgress !== null) {
            setLoading(false);
        }
    }, [townData, playerProgress]);


    const handlePuzzleSuccess = async () => {
        if (!worldId || !townId || !currentUser) return;
        const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', townId, 'playerProgress', currentUser.uid);
        await updateDoc(playerProgressRef, { puzzleSolved: true });
        setPlayerProgress(prev => ({ ...prev, puzzleSolved: true }));
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="bg-gray-800 p-6 rounded-lg text-white">Loading...</div>
            </div>
        );
    }

    if (!townData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="bg-gray-800 p-6 rounded-lg text-white" onClick={e => e.stopPropagation()}>
                    <p>Could not load God Town information.</p>
                    <button onClick={onClose} className="btn btn-primary mt-4">Close</button>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (townData.stage === 'ruins') {
            return (
                <div>
                    <h3 className="font-title text-2xl">Strange Ruins</h3>
                    <p>These ancient ruins hum with a mysterious power. It seems they are slowly reforming into something grander.</p>
                    <p className="mt-4">Time until transformation: 
                        <span className="font-bold text-yellow-400 ml-2">
                            <Countdown arrivalTime={townData.transformationTime} />
                        </span>
                    </p>
                </div>
            );
        }

        if (townData.stage === 'city') {
            if (!playerProgress?.puzzleSolved) {
                return (
                    <div>
                        <h3 className="font-title text-2xl">The God Town's Challenge</h3>
                        <p>To prove your worthiness to attack, you must first solve a riddle posed by the town's ancient guardians.</p>
                        <PuzzleRenderer puzzleId={townData.puzzleId} onSolve={handlePuzzleSuccess} />
                    </div>
                );
            }
            return (
                <div>
                    <h3 className="font-title text-2xl">{townData.name}</h3>
                    <p>The city is vulnerable. Attack to earn war points and resources!</p>
                    <div className="my-4">
                        <TroopDisplay units={townData.troops || {}} title="Garrison" />
                    </div>
                    <button onClick={() => onAttack(townData)} className="btn btn-danger mt-4">Attack</button>
                </div>
            );
        }

        return <p>The God Town has been conquered and has settled on a new island!</p>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default GodTownModal;
