// src/components/chat/Chat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import './Chat.css';

const Chat = ({ isVisible, onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();
    const { playerAlliance } = useAlliance(); // Use the correct context for alliance data
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [activeTab, setActiveTab] = useState('world');
    const messagesEndRef = useRef(null);

    // Draggable state
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 540 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const chatWindowRef = useRef(null);

    // #comment fetch messages based on the active tab (world or alliance)
    useEffect(() => {
        if (!worldId) return;

        let chatCollectionRef;
        if (activeTab === 'world') {
            chatCollectionRef = collection(db, 'worlds', worldId, 'chat');
        } else if (activeTab === 'alliance' && playerAlliance) {
            chatCollectionRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'chat');
        } else {
            setMessages([]);
            return;
        }

        const q = query(chatCollectionRef, orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [worldId, activeTab, playerAlliance]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // #comment send a new message to the currently active chat tab
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !worldId || !currentUser || !userProfile) return;

        let chatCollectionRef;
        if (activeTab === 'world') {
            chatCollectionRef = collection(db, 'worlds', worldId, 'chat');
        } else if (activeTab === 'alliance' && playerAlliance) {
            chatCollectionRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'chat');
        } else {
            return; // Can't send message if no valid chat is selected
        }

        await addDoc(chatCollectionRef, {
            text: newMessage,
            timestamp: serverTimestamp(),
            uid: currentUser.uid,
            authorName: userProfile.username,
        });

        setNewMessage('');
    };
    
    // #comment handle mouse down for dragging the chat window
    const handleMouseDown = (e) => {
        if (e.target.classList.contains('chat-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    // #comment handle mouse move for dragging
    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart, setPosition]);

    // #comment handle mouse up to stop dragging
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


    if (!isVisible) return null;

    return (
        <div 
            className="chat-window" 
            ref={chatWindowRef}
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
        >
            <div className="chat-header" onMouseDown={handleMouseDown}>
                <h4>Chat</h4>
                <button onClick={onClose} className="close-btn">&times;</button>
            </div>
            <div className="chat-tabs">
                <button 
                    className={`chat-tab ${activeTab === 'world' ? 'active' : ''}`}
                    onClick={() => setActiveTab('world')}
                >
                    World
                </button>
                <button 
                    className={`chat-tab ${activeTab === 'alliance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('alliance')}
                    disabled={!playerAlliance}
                    title={!playerAlliance ? "You are not in an alliance" : "Alliance Chat"}
                >
                    Alliance
                </button>
            </div>
            <div className="messages-container">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.uid === currentUser.uid ? 'sent' : 'received'}`}>
                        <span className="author">{msg.authorName}:</span>
                        <p>{msg.text}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="send-message-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    maxLength="75"
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;
