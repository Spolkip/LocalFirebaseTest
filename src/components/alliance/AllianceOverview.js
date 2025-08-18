import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AllianceOverview = () => {
    const { worldId } = useGame();
    const { playerAlliance } = useAlliance();
    const [events, setEvents] = useState([]);

    // #comment Fetch alliance events in real-time
    useEffect(() => {
        if (!worldId || !playerAlliance) return;
        const eventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        const q = query(eventsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [worldId, playerAlliance]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                 <div className="alliance-bg-light alliance-text-light p-4 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Internal Bulletin (Private)</h3>
                    <p className="whitespace-pre-wrap">{playerAlliance.settings.privateDescription || 'No private description provided.'}</p>
                </div>
            </div>
            <div>
                <h3 className="text-xl font-bold mb-2">Recent Events</h3>
                <ul className="space-y-2 max-h-64 overflow-y-auto bg-gray-700/50 p-3 rounded-lg">
                    {events.length > 0 ? events.map(event => (
                        <li key={event.id} className="p-2 bg-gray-800/60 rounded">
                            <p className="text-sm">{event.text}</p>
                            <p className="text-xs text-gray-400 text-right">{event.timestamp?.toDate().toLocaleString()}</p>
                        </li>
                    )) : (
                        <li className="text-gray-500 italic text-center p-4">No recent events.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default AllianceOverview;
