// src/components/map/Notes.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import TextEditor from '../shared/TextEditor';
import './Notes.css';

const Notes = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { worldId } = useGame();
    const [notes, setNotes] = useState([]);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [message, setMessage] = useState('');
    const notesRef = useRef(null);
    const [position, setPosition] = useState({
        x: window.innerWidth - 420,
        y: 80
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const debounceTimeout = useRef(null);
    const [editingNote, setEditingNote] = useState(null); // State for editing title

    // #comment Fetch notes from the subcollection
    useEffect(() => {
        if (!currentUser || !worldId) return;
        const notesCollectionRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'notes');
        const q = query(notesCollectionRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                // If no notes exist, create a default one
                const newNoteRef = await addDoc(notesCollectionRef, {
                    title: 'Note 1',
                    content: '',
                    createdAt: serverTimestamp()
                });
                setNotes([{ id: newNoteRef.id, title: 'Note 1', content: '' }]);
                setActiveNoteId(newNoteRef.id);
            } else {
                const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setNotes(notesData);
                if (!activeNoteId || !notesData.some(n => n.id === activeNoteId)) {
                    setActiveNoteId(notesData[0].id);
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser, worldId, activeNoteId]);

    // #comment Debounced save function for the text editor
    const handleNoteChange = (content) => {
        if (!activeNoteId) return;

        // Update state immediately for responsive UI
        setNotes(prevNotes => prevNotes.map(note =>
            note.id === activeNoteId ? { ...note, content } : note
        ));

        // Debounce Firestore update
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(async () => {
            const noteDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'notes', activeNoteId);
            try {
                await updateDoc(noteDocRef, { content });
            } catch (error) {
                console.error("Error auto-saving note:", error);
            }
        }, 1000); // Save 1 second after user stops typing
    };

    const handleAddTab = async () => {
        if (notes.length >= 5) {
            setMessage("Maximum of 5 notes reached.");
            setTimeout(() => setMessage(''), 2000);
            return;
        }
        const notesCollectionRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'notes');
        const newNoteRef = await addDoc(notesCollectionRef, {
            title: `Note ${notes.length + 1}`,
            content: '',
            createdAt: serverTimestamp()
        });
        setActiveNoteId(newNoteRef.id);
    };

    const handleDeleteTab = async (noteIdToDelete) => {
        if (notes.length <= 1) {
            setMessage("You must have at least one note.");
            setTimeout(() => setMessage(''), 2000);
            return;
        }
        const noteDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'notes', noteIdToDelete);
        await deleteDoc(noteDocRef);
        // Active note will be reset by the useEffect listener
    };

    // #comment Handle renaming a note tab
    const handleRenameNote = async (noteId, newTitle) => {
        if (!newTitle.trim()) {
            setMessage("Title cannot be empty.");
            setTimeout(() => setMessage(''), 2000);
            setEditingNote(null); // Cancel editing
            return;
        }
        const noteDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'notes', noteId);
        await updateDoc(noteDocRef, { title: newTitle.trim() });
        setEditingNote(null); // Finish editing
    };

    // #comment Handlers for making the notes panel draggable
    const handleMouseDown = (e) => {
        if (e.target.classList.contains('notes-header') || e.target.classList.contains('notes-tabs')) {
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

    const activeNote = notes.find(n => n.id === activeNoteId);

    return (
        <div
            ref={notesRef}
            className="notes-container"
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            onClick={e => e.stopPropagation()}
        >
            <div className="notes-header" onMouseDown={handleMouseDown}>
                <h3>Player Notes</h3>
                <button onClick={onClose} className="close-btn">&times;</button>
            </div>
            <div className="notes-tabs" onMouseDown={handleMouseDown}>
                {notes.map(note => (
                    <div key={note.id} className={`note-tab ${activeNoteId === note.id ? 'active' : ''}`} onClick={() => setActiveNoteId(note.id)}>
                        {editingNote?.id === note.id ? (
                            <input
                                type="text"
                                value={editingNote.title}
                                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                                onBlur={() => handleRenameNote(editingNote.id, editingNote.title)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameNote(editingNote.id, editingNote.title);
                                    if (e.key === 'Escape') setEditingNote(null);
                                }}
                                onClick={(e) => e.stopPropagation()} // Prevent tab switching while editing
                                autoFocus
                                className="note-title-input"
                            />
                        ) : (
                            <span onDoubleClick={() => setEditingNote({ id: note.id, title: note.title })}>
                                {note.title}
                            </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTab(note.id); }} className="delete-tab-btn">&times;</button>
                    </div>
                ))}
                <button onClick={handleAddTab} className="add-tab-btn">+</button>
            </div>
            {activeNote ? (
                <TextEditor
                    value={activeNote.content}
                    onChange={handleNoteChange}
                />
            ) : (
                <div className="notes-textarea flex items-center justify-center">Loading note...</div>
            )}
            <div className="notes-footer">
                {message && <span className="save-message">{message}</span>}
            </div>
        </div>
    );
};

export default Notes;