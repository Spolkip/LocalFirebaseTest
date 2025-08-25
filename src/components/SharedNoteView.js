// src/components/SharedNoteView.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useGame } from '../contexts/GameContext';
import { parseBBCode } from '../utils/bbcodeParser';

const SharedNoteView = ({ noteId, worldId: propWorldId, isEmbedded, onActionClick }) => {
    const gameContext = useGame();
    const worldId = propWorldId || gameContext?.worldId;
    const [note, setNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNote = async () => {
            if (!worldId || !noteId) {
                setError('Invalid note information.');
                setLoading(false);
                return;
            }
            try {
                const noteRef = doc(db, 'worlds', worldId, 'shared_notes', noteId);
                const noteSnap = await getDoc(noteRef);
                if (noteSnap.exists()) {
                    setNote(noteSnap.data());
                } else {
                    setError('This note could not be found. It may have been deleted.');
                }
            } catch (err) {
                setError('An error occurred while fetching the note.');
                console.error(err);
            }
            setLoading(false);
        };

        fetchNote();
    }, [worldId, noteId]);

    const handleContentClick = (e) => {
        if (!onActionClick) return;
        const target = e.target;
        if (target.classList.contains('bbcode-action')) {
            const { actionType, actionId, actionOwnerId, actionCoordsX, actionCoordsY } = target.dataset;
            if (actionType === 'city_link') {
                onActionClick(actionType, { cityId: actionId, ownerId: actionOwnerId, coords: { x: actionCoordsX, y: actionCoordsY } });
            } else {
                const data = actionId || { x: actionCoordsX, y: actionCoordsY };
                if (actionType && data) {
                    onActionClick(actionType, data);
                }
            }
        }
    };

    if (isEmbedded) {
        if (loading) return <div className="text-xs">Loading note...</div>;
        if (error) return <div className="text-xs text-red-500">{error}</div>;
        if (!note) return null;
        return (
            <div className="p-2 border border-yellow-800/50 my-2" onClick={handleContentClick}>
                <h4 className="font-bold text-center text-sm mb-2">{note.title}</h4>
                <div className="text-xs" dangerouslySetInnerHTML={{ __html: parseBBCode(note.content) }} />
            </div>
        );
    }

    return null; // Standalone view not implemented for now
};

export default SharedNoteView;