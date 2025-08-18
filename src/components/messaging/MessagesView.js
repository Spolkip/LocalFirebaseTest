import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, setDoc, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { parseBBCode } from '../../utils/bbcodeParser';
import SharedReportView from '../SharedReportView';
import ReactDOM from 'react-dom';
import './MessagesView.css';
import TextEditor from '../shared/TextEditor';
import { playerCache } from '../alliance/AllianceInvitations';
const MessagesView = ({ onClose, initialRecipientId = null, initialRecipientUsername = null, onActionClick }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [newRecipient, setNewRecipient] = useState('');
    const [isComposing, setIsComposing] = useState(false);
    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null); // Ref for the message container
    // Autocomplete states
    const [allPlayers, setAllPlayers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    // #comment Fetch all players for autocomplete using the shared cache
    useEffect(() => {
        const fetchPlayers = async () => {
            const now = Date.now();
            const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
            if (now - playerCache.timestamp < CACHE_DURATION && playerCache.allPlayers) {
                setAllPlayers(playerCache.allPlayers);
            } else {
                const usersRef = collection(db, 'users');
                const snapshot = await getDocs(usersRef);
                const players = snapshot.docs
                    .map(doc => doc.data().username)
                    .filter(username => username !== userProfile.username);
                setAllPlayers(players);
                playerCache.allPlayers = players;
                playerCache.timestamp = now;
            }
        };
        fetchPlayers();
    }, [userProfile.username]);
    const handleCompose = useCallback(async (recipientId = null, recipientUsername = null) => {
        if (recipientId && recipientUsername) {
            const convoQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', 'in', [[currentUser.uid, recipientId], [recipientId, currentUser.uid]])
            );
            const convoSnapshot = await getDocs(convoQuery);
            if (!convoSnapshot.empty) {
                setSelectedConversation({ id: convoSnapshot.docs[0].id, ...convoSnapshot.docs[0].data() });
                setIsComposing(false);
                return;
            }
        }
        setSelectedConversation(null);
        setIsComposing(true);
        if (recipientUsername) {
            setNewRecipient(recipientUsername);
        }
    }, [currentUser, worldId]);
    useEffect(() => {
        if (!currentUser || !worldId) return;
        const conversationsQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
            const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            convos.sort((a, b) => (b.lastMessage?.timestamp?.toDate() || 0) - (a.lastMessage?.timestamp?.toDate() || 0));
            setConversations(convos);
        });
        return () => unsubscribe();
    }, [currentUser, worldId]);
    useEffect(() => {
        if (initialRecipientId && initialRecipientUsername) {
            handleCompose(initialRecipientId, initialRecipientUsername);
        }
    }, [initialRecipientId, initialRecipientUsername, handleCompose]);
    useEffect(() => {
        if (selectedConversation) {
            const messagesQuery = query(
                collection(db, 'worlds', worldId, 'conversations', selectedConversation.id, 'messages'),
                orderBy('timestamp', 'asc')
            );
            const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMessages(msgs);
            });
            const convoRef = doc(db, 'worlds', worldId, 'conversations', selectedConversation.id);
            updateDoc(convoRef, {
                readBy: arrayUnion(currentUser.uid)
            });
            return () => unsubscribe();
        }
    }, [selectedConversation, worldId, currentUser.uid]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    useEffect(() => {
        if (messageContainerRef.current) {
            const placeholders = messageContainerRef.current.querySelectorAll('.shared-report-placeholder');
            placeholders.forEach(placeholder => {
                const reportId = placeholder.dataset.reportId;
                if (reportId) {
                    ReactDOM.render(<SharedReportView reportId={reportId} worldId={worldId} onClose={() => {}} isEmbedded={true} onActionClick={onActionClick} />, placeholder);
                }
            });
        }
    }, [messages, worldId, onActionClick]);
    const handleSelectConversation = async (convo) => {
        setSelectedConversation(convo);
        setIsComposing(false);
    };
    const getOtherParticipant = (convo) => {
        if (!convo || !convo.participants || !convo.participantUsernames) return 'Unknown';
        const otherId = convo.participants.find(p => p !== currentUser.uid);
        return convo.participantUsernames[otherId] || 'Unknown';
    };
    const isSystemChat = selectedConversation ? getOtherParticipant(selectedConversation) === 'System' : false;
    const handleSendMessage = async () => {
        if (isSystemChat) return;
        if (newMessage.trim() === '' || (!selectedConversation && !newRecipient)) return;
        let conversationId = selectedConversation?.id;
        if (isComposing) {
            if (newRecipient.toLowerCase() === 'system') {
                alert("You cannot send messages to the System.");
                return;
            }
            const recipientQuery = query(collection(db, 'users'), where('username', '==', newRecipient));
            const recipientSnapshot = await getDocs(recipientQuery);
            if (recipientSnapshot.empty) {
                alert('Recipient not found.');
                return;
            }
            const recipientData = recipientSnapshot.docs[0].data();
            const recipientId = recipientSnapshot.docs[0].id;
            if (recipientId === currentUser.uid) {
                alert("You cannot send a message to yourself.");
                return;
            }
            const convoQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', 'in', [[currentUser.uid, recipientId], [recipientId, currentUser.uid]])
            );
            const convoSnapshot = await getDocs(convoQuery);
            if (convoSnapshot.empty) {
                const newConvoRef = doc(collection(db, 'worlds', worldId, 'conversations'));
                await setDoc(newConvoRef, {
                    participants: [currentUser.uid, recipientId],
                    participantUsernames: {
                        [currentUser.uid]: userProfile.username,
                        [recipientId]: recipientData.username,
                    },
                    lastMessage: {
                        text: newMessage,
                        senderId: currentUser.uid,
                        timestamp: serverTimestamp(),
                    },
                    readBy: [currentUser.uid],
                });
                conversationId = newConvoRef.id;
            } else {
                conversationId = convoSnapshot.docs[0].id;
            }
        }
        const convoRef = doc(db, 'worlds', worldId, 'conversations', conversationId);
        await addDoc(collection(convoRef, 'messages'), {
            text: newMessage,
            senderId: currentUser.uid,
            senderUsername: userProfile.username,
            timestamp: serverTimestamp(),
        });
        await updateDoc(convoRef, {
            lastMessage: {
                text: newMessage,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
            },
            readBy: [currentUser.uid],
        });
        setNewMessage('');
        if (isComposing) {
            setIsComposing(false);
            setNewRecipient('');
            const newConvo = await getDoc(convoRef);
            setSelectedConversation({ id: newConvo.id, ...newConvo.data() });
        }
    };
    const handleContentClick = (e) => {
        const target = e.target;
        if (target.classList.contains('bbcode-action') && onActionClick) {
            const { actionType, actionId, actionOwnerId, actionCoordsX, actionCoordsY } = target.dataset;
            if (actionType === 'city_link') {
                onActionClick(actionType, { cityId: actionId, ownerId: actionOwnerId, coords: { x: actionCoordsX, y: actionCoordsY } });
            } else {
                const data = actionId || { x: actionCoordsX, y: actionCoordsY };
                if (actionType && data) {
                    onActionClick(actionType, data);
                }
            }
            onClose();
        }
    };
    const handleRecipientChange = (e) => {
        const value = e.target.value;
        setNewRecipient(value);
        if (value.length > 0) {
            const filteredSuggestions = allPlayers.filter(player =>
                player.toLowerCase().startsWith(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    };
    const handleSuggestionClick = (username) => {
        setNewRecipient(username);
        setSuggestions([]);
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="papyrus-bg papyrus-text" onClick={e => e.stopPropagation()}>
                <div className="messages-header">
                    <button onClick={onClose} className="papyrus-text text-3xl font-bold hover:text-red-700">&times;</button>
                </div>
                <div className="messages-body">
                    <div className="messages-left-panel">
                        <div className="p-2 border-b-2 border-[#8B4513]">
                            <button onClick={() => handleCompose()} className="w-full papyrus-btn">
                                New Scroll
                            </button>
                        </div>
                        <ul className="overflow-y-auto">
                            {conversations.map(convo => {
                                const isUnread = convo.lastMessage?.senderId !== currentUser.uid && !convo.readBy.includes(currentUser.uid);
                                return (
                                <li
                                    key={convo.id}
                                    className={`papyrus-list-item ${selectedConversation?.id === convo.id ? 'selected' : ''} ${isUnread ? 'unread glowing-message' : ''}`}
                                    onClick={() => handleSelectConversation(convo)}
                                >
                                    <p className="font-title text-lg">{getOtherParticipant(convo)}</p>
                                    <p className="text-sm truncate">{convo.lastMessage?.text}</p>
                                </li>
                            )})}
                        </ul>
                    </div>
                    <div className="messages-right-panel">
                        {selectedConversation || isComposing ? (
                            <>
                                <div className="p-4 border-b-2 border-[#8B4513] autocomplete-suggestions-container">
                                    {isComposing ? (
                                        <div>
                                            <input
                                                type="text"
                                                value={newRecipient}
                                                onChange={handleRecipientChange}
                                                placeholder="Scribe the recipient's name..."
                                                className="w-full papyrus-input text-lg"
                                                autoComplete="off"
                                            />
                                            {suggestions.length > 0 && (
                                                <ul className="autocomplete-suggestions-list light">
                                                    {suggestions.map(player => (
                                                        <li key={player} onClick={() => handleSuggestionClick(player)}>
                                                            {player}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ) : (
                                        <h3 className="font-bold text-lg font-title">{getOtherParticipant(selectedConversation)}</h3>
                                    )}
                                </div>
                                <div ref={messageContainerRef} className="flex-grow overflow-y-auto p-4 space-y-4" onClick={handleContentClick}>
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`${msg.senderId === currentUser.uid ? 'papyrus-message-sent' : 'papyrus-message-received'}`}>
                                                <p className="font-bold text-sm font-title">{msg.senderUsername}</p>
                                                <div dangerouslySetInnerHTML={{ __html: parseBBCode(msg.text) }} />
                                                <p className="text-xs text-gray-100/70 mt-1 text-right">{msg.timestamp?.toDate().toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                {!isSystemChat && (
                                    <div className="p-4 border-t-2 border-[#8B4513] mt-auto">
                                        <div className="flex">
                                            <TextEditor value={newMessage} onChange={setNewMessage} />
                                            <button onClick={handleSendMessage} className="papyrus-btn ml-2">Send</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-100 italic">Select a conversation or start a new one.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default MessagesView;
