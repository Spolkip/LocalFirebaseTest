import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { db } from '../../firebase/config';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import TextEditor from '../shared/TextEditor';
import { parseBBCode } from '../../utils/bbcodeParser';
import SharedReportView from '../SharedReportView';
import './AllianceForum.css';


const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600 text-white">
            <p className="mb-6 text-lg">{message}</p>
            <div className="flex justify-center space-x-4">
                <button onClick={onCancel} className="forum-btn">Cancel</button>
                <button onClick={onConfirm} className="forum-btn">Confirm</button>
            </div>
        </div>
    </div>
);

const AllianceForum = ({ onClose, onActionClick }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();
    const { playerAlliance } = useAlliance();


    const [forums, setForums] = useState([]);
    const [selectedForum, setSelectedForum] = useState(null);
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [posts, setPosts] = useState([]);


    const [newForumName, setNewForumName] = useState('');
    const [isNewForumSecret, setIsNewForumSecret] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newPostContent, setNewPostContent] = useState('');
    const [isCreatingForum, setIsCreatingForum] = useState(false);
    const [isCreatingThread, setIsCreatingThread] = useState(false);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingPostContent, setEditingPostContent] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [editingForum, setEditingForum] = useState(null);
    const postsEndRef = useRef(null);
    const postContainerRef = useRef(null); // Ref for the post container

    const isLeader = currentUser?.uid === playerAlliance?.leader?.uid;

    const forumRef = useRef(null);
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 1000) / 2,
        y: (window.innerHeight - 700) / 2
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('alliance-forum-header') || e.target.parentElement.classList.contains('alliance-forum-header')) {
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


    // #comment Get current member's rank and permissions
    const memberRankData = useMemo(() => {
        if (!playerAlliance || !currentUser) return null;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return null;
        return playerAlliance.ranks.find(r => r.id === member.rank);
    }, [playerAlliance, currentUser]);

    const canViewSecretForums = memberRankData?.permissions?.viewSecretForums || isLeader;


    useEffect(() => {
        if (!worldId || !playerAlliance) return;
        const forumsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums');
        const q = query(forumsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const forumsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setForums(forumsData);
            if (!selectedForum && forumsData.length > 0) {
                setSelectedForum(forumsData[0]);
            }
        });
        return () => unsubscribe();
    }, [worldId, playerAlliance, selectedForum]);


    useEffect(() => {
        if (!selectedForum) return;
        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads');
        const q = query(threadsRef, orderBy('lastReplyAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [selectedForum, worldId, playerAlliance]);


    useEffect(() => {
        if (!selectedThread) {
            setPosts([]);
            return;
        }
        const postsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [selectedThread, selectedForum, worldId, playerAlliance]);

    useEffect(() => {
        postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts]);


    useEffect(() => {
        if (postContainerRef.current) {
            const placeholders = postContainerRef.current.querySelectorAll('.shared-report-placeholder');
            placeholders.forEach(placeholder => {
                const reportId = placeholder.dataset.reportId;
                if (reportId) {
                    ReactDOM.render(<SharedReportView reportId={reportId} worldId={worldId} onClose={() => {}} isEmbedded={true} onActionClick={onActionClick} />, placeholder);
                }
            });
        }
    }, [posts, worldId, onActionClick]);


    const handleCreateForum = async (e) => {
        e.preventDefault();
        if (!newForumName.trim() || !isLeader) return;
        const forumsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums');
        await addDoc(forumsRef, {
            name: newForumName,
            isSecret: isNewForumSecret,
            createdAt: serverTimestamp(),
        });
        setNewForumName('');
        setIsNewForumSecret(false);
        setIsCreatingForum(false);
    };

    // handle creation of a new thread within a forum
    const handleCreateThread = async (e) => {
        e.preventDefault();
        if (!newThreadTitle.trim() || !newPostContent.trim() || !selectedForum) return;

        const threadsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads');
        const newThreadRef = doc(threadsRef);

        await setDoc(newThreadRef, {
            title: newThreadTitle,
            creatorId: currentUser.uid,
            creatorUsername: userProfile.username,
            createdAt: serverTimestamp(),
            lastReplyAt: serverTimestamp(),
            lastReplyBy: userProfile.username,
            lastReplyById: currentUser.uid,
            replyCount: 0,
        });

        const postsRef = collection(newThreadRef, 'posts');
        await addDoc(postsRef, {
            content: newPostContent,
            authorId: currentUser.uid,
            authorUsername: userProfile.username,
            createdAt: serverTimestamp(),
        });

        setNewThreadTitle('');
        setNewPostContent('');
        setIsCreatingThread(false);
    };

    // handle replying to a thread
    const handleReply = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() || !selectedThread) return;

        const threadRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id);
        const postsRef = collection(threadRef, 'posts');

        await addDoc(postsRef, {
            content: newPostContent,
            authorId: currentUser.uid,
            authorUsername: userProfile.username,
            createdAt: serverTimestamp(),
        });

        await updateDoc(threadRef, {
            lastReplyAt: serverTimestamp(),
            lastReplyBy: userProfile.username,
            lastReplyById: currentUser.uid,
            replyCount: (selectedThread.replyCount || 0) + 1,
        });

        setNewPostContent('');
    };

    // handle deleting a post
    const handleDeletePost = (postId) => {
        setConfirmAction({
            message: "Are you sure you want to delete this post?",
            onConfirm: async () => {
                if (!selectedThread) return;
                const postRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts', postId);
                await deleteDoc(postRef);
                setConfirmAction(null);
            }
        });
    };


    const handleStartEdit = (post) => {
        setEditingPostId(post.id);
        setEditingPostContent(post.content);
    };


    const handleCancelEdit = () => {
        setEditingPostId(null);
        setEditingPostContent('');
    };

    // handle submitting an updated post
    const handleUpdatePost = async (e) => {
        e.preventDefault();
        if (!editingPostContent.trim() || !editingPostId) return;

        const postRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', selectedForum.id, 'threads', selectedThread.id, 'posts', editingPostId);
        await updateDoc(postRef, {
            content: editingPostContent,
            editedAt: serverTimestamp(),
        });

        handleCancelEdit();
    };

    const handleUpdateForum = async (e, forumId) => {
        e.preventDefault();
        if (!editingForum || !editingForum.name.trim() || !isLeader) return;
        const forumRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', forumId);
        await updateDoc(forumRef, {
            name: editingForum.name,
            isSecret: editingForum.isSecret,
        });
        setEditingForum(null);
    };

    const handleDeleteForum = (forumId) => {
        setConfirmAction({
            message: "Are you sure you want to delete this forum and all its threads? This cannot be undone.",
            onConfirm: async () => {
                if (!isLeader) return;

                const forumRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'forums', forumId);
                const threadsRef = collection(forumRef, 'threads');
                const threadsSnapshot = await getDocs(threadsRef);

                const batch = writeBatch(db);

                for (const threadDoc of threadsSnapshot.docs) {
                    const postsRef = collection(threadDoc.ref, 'posts');
                    const postsSnapshot = await getDocs(postsRef);
                    postsSnapshot.forEach(postDoc => {
                        batch.delete(postDoc.ref);
                    });
                    batch.delete(threadDoc.ref);
                }

                batch.delete(forumRef);

                await batch.commit();

                if (selectedForum?.id === forumId) {
                    setSelectedForum(null);
                    setThreads([]);
                    setSelectedThread(null);
                }
                setConfirmAction(null);
            }
        });
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

    const visibleForums = useMemo(() => {
        return forums.filter(forum => !forum.isSecret || canViewSecretForums);
    }, [forums, canViewSecretForums]);

    const renderContent = () => {
        if (isCreatingThread) {
            return (
                 <div className="p-4">
                    <h3 className="forum-header -m-4 mb-4 p-2">Create New Thread in {selectedForum?.name}</h3>
                    <form onSubmit={handleCreateThread} className="space-y-3">
                        <input type="text" value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} placeholder="Thread Title" className="w-full bg-yellow-50/50 p-2 rounded border border-yellow-800/50 text-gray-800" />
                        <TextEditor value={newPostContent} onChange={setNewPostContent} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreatingThread(false)} className="forum-btn">Cancel</button>
                            <button type="submit" className="forum-btn">Create</button>
                        </div>
                    </form>
                </div>
            );
        }

        if (selectedThread) {
            return (
                 <div className="flex flex-col h-full">
                    <div className="forum-header -m-6 mb-4 p-2 flex items-center">
                        <button onClick={() => setSelectedThread(null)} className="text-yellow-300 hover:text-white mr-4 text-sm">{'< Back'}</button>
                        <span className="font-bold">{selectedThread.title}</span>
                    </div>
                    <div ref={postContainerRef} className="space-y-4 mb-4 flex-grow overflow-y-auto p-2" onClick={handleContentClick}>
                        {posts.map(post => (
                            <div key={post.id} className="post-item">
                                <p className="post-author" dangerouslySetInnerHTML={{ __html: parseBBCode(`[player id=${post.authorId}]${post.authorUsername}[/player]`) }} />
                                {editingPostId === post.id ? (
                                    <form onSubmit={handleUpdatePost}>
                                        <TextEditor value={editingPostContent} onChange={setEditingPostContent} />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button type="button" onClick={handleCancelEdit} className="forum-btn">Cancel</button>
                                            <button type="submit" className="forum-btn">Save</button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div className="post-content" dangerouslySetInnerHTML={{ __html: parseBBCode(post.content) }} />
                                        <div className="flex justify-between items-center">
                                            <p className="post-timestamp">
                                                {post.createdAt?.toDate().toLocaleString()}
                                                {post.editedAt && <em className="ml-2">(edited)</em>}
                                            </p>
                                            {currentUser.uid === post.authorId && (
                                                <div className="post-actions">
                                                    <button onClick={() => handleStartEdit(post)} className="post-action-btn">Edit</button>
                                                    <button onClick={() => handleDeletePost(post.id)} className="post-action-btn">Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div ref={postsEndRef} />
                    </div>
                    <form onSubmit={handleReply} className="mt-auto flex-shrink-0 p-2 reply-form">
                        <TextEditor value={newPostContent} onChange={setNewPostContent} />
                        <div className="flex justify-end mt-2">
                            <button type="submit" className="forum-btn">Post Reply</button>
                        </div>
                    </form>
                </div>
            );
        }

        return (
            <div>
                <table className="forum-table">
                    <thead>
                        <tr>
                            <th className="w-2/3">Theme</th>
                            <th className="text-center">Replies</th>
                            <th>Last Post</th>
                        </tr>
                    </thead>
                    <tbody>
                        {threads.map(thread => (
                            <tr key={thread.id} onClick={() => setSelectedThread(thread)}>
                                <td>
                                    <p className="font-bold">{thread.title}</p>
                                    <p className="text-xs" dangerouslySetInnerHTML={{ __html: `by ${parseBBCode(`[player id=${thread.creatorId}]${thread.creatorUsername}[/player]`)} on ${thread.createdAt?.toDate().toLocaleDateString()}` }} />
                                </td>
                                <td className="text-center">{thread.replyCount || 0}</td>
                                <td>
                                    <p className="font-bold text-sm" dangerouslySetInnerHTML={{ __html: thread.lastReplyById ? parseBBCode(`[player id=${thread.lastReplyById}]${thread.lastReplyBy}[/player]`) : thread.lastReplyBy }} />
                                    <p className="text-xs">{thread.lastReplyAt?.toDate().toLocaleString()}</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-4 flex justify-start gap-4">
                    {forums.length > 0 && (
                        <button onClick={() => setIsCreatingThread(true)} className="forum-btn">New Thread</button>
                    )}
                </div>
            </div>
        );
    };

    if (!playerAlliance) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="forum-container w-full max-w-lg h-auto flex flex-col items-center justify-center p-8" onClick={e => e.stopPropagation()}>
                    <p className="text-2xl text-center">You must be in an alliance to view the forum.</p>
                    <button onClick={onClose} className="forum-btn mt-6">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            {confirmAction && (
                <ConfirmationModal
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <div 
                ref={forumRef}
                className="forum-container w-full max-w-5xl h-5/6 flex flex-col"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
                <div className="p-4 flex justify-between items-center alliance-forum-header">
                    <h2 className="font-title text-3xl">Alliance Forum</h2>
                    <button onClick={onClose} className="text-3xl leading-none hover:text-red-700">&times;</button>
                </div>
                <div className="forum-tabs-container">
                    {visibleForums.map(forum => (
                        <div key={forum.id} className="relative group">
                            {editingForum?.id === forum.id ? (
                                <form onSubmit={(e) => handleUpdateForum(e, forum.id)} className="p-1 flex items-center">
                                    <input
                                        type="text"
                                        value={editingForum.name}
                                        onChange={(e) => setEditingForum(prev => ({ ...prev, name: e.target.value }))}
                                        className="bg-white/20 text-white p-1 rounded text-sm"
                                        autoFocus
                                    />
                                    <label className="flex items-center ml-2 text-sm text-white">
                                        <input
                                            type="checkbox"
                                            checked={editingForum.isSecret}
                                            onChange={(e) => setEditingForum(prev => ({ ...prev, isSecret: e.target.checked }))}
                                            className="mr-1"
                                        />
                                        Secret
                                    </label>
                                    <button type="submit" className="ml-2 text-white text-xl">✓</button>
                                    <button type="button" onClick={() => setEditingForum(null)} className="ml-1 text-white text-xl">x</button>
                                </form>
                            ) : (
                                <>
                                    <button onClick={() => setSelectedForum(forum)} className={`forum-tab ${selectedForum?.id === forum.id ? 'active' : ''}`}>
                                        {forum.name} {forum.isSecret && '🔒'}
                                    </button>
                                    {isLeader && (
                                        <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingForum({ id: forum.id, name: forum.name, isSecret: forum.isSecret || false })} className="text-white text-xs p-1">✏️</button>
                                            <button onClick={() => handleDeleteForum(forum.id)} className="text-white text-xs p-1">🗑️</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                    {isLeader && (
                        isCreatingForum ? (
                            <form onSubmit={handleCreateForum} className="p-1 flex items-center">
                                <input type="text" value={newForumName} onChange={(e) => setNewForumName(e.target.value)} placeholder="New Forum Name" className="bg-white/20 text-white p-1 rounded text-sm" />
                                <label className="flex items-center ml-2 text-sm text-white">
                                    <input type="checkbox" checked={isNewForumSecret} onChange={(e) => setIsNewForumSecret(e.target.checked)} className="mr-1" />
                                    Secret
                                </label>
                                <button type="submit" className="ml-2 text-white text-xl">+</button>
                                <button type="button" onClick={() => setIsCreatingForum(false)} className="ml-1 text-white text-xl">x</button>
                            </form>
                        ) : (
                            <button onClick={() => setIsCreatingForum(true)} className="forum-tab new-forum-btn">+</button>
                        )
                    )}
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default AllianceForum;
