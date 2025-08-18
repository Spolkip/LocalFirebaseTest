// src/components/map/AllianceModal.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';
import AllianceOverview from '../alliance/AllianceOverview';
import AllianceMembers from '../alliance/AllianceMembers';
import AllianceResearch from '../alliance/AllianceResearch';
import AllianceDiplomacy from '../alliance/AllianceDiplomacy';
import AllianceSettings from '../alliance/AllianceSettings';
import AllianceInvitations from '../alliance/AllianceInvitations';
import AllianceRanks from '../alliance/AllianceRanks';
import AllianceProperties from '../alliance/AllianceProperties';
import AllianceBank from '../alliance/AllianceBank';
import AllianceSuggestions from '../alliance/AllianceSuggestions';
import AllianceCreation from '../alliance/AllianceCreation';
import './AllianceModal.css';

const AllianceModal = ({ onClose, onOpenAllianceProfile, openModal }) => {
    const { playerAlliance } = useAlliance();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState(playerAlliance ? 'overview' : 'suggestions');
    const [isCreating, setIsCreating] = useState(false);

    // #comment Draggable state and handlers
    const [position, setPosition] = useState({ 
        x: (window.innerWidth - 1000) / 2, // Center horizontally
        y: (window.innerHeight * 0.1) / 2  // Position near the top
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const modalRef = useRef(null);

    const handleMouseDown = (e) => {
        // Draggable only by the header or its direct children
        if (e.target.classList.contains('alliance-modal-header') || e.target.parentElement.classList.contains('alliance-modal-header')) {
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

    const handleOpenCreate = () => {
        setIsCreating(true);
    };

    const handleCloseCreate = () => {
        setIsCreating(false);
        onClose(); // Close the main alliance modal too after creation
    };

    if (isCreating) {
        return <AllianceCreation onClose={handleCloseCreate} />;
    }

    if (!playerAlliance) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="alliance-modal" onClick={e => e.stopPropagation()}>
                    <div className="alliance-modal-header">
                        <h2 className="text-2xl font-bold text-white">Join an Alliance</h2>
                        <button onClick={onClose} className="close-button">&times;</button>
                    </div>
                    <div className="alliance-modal-content">
                        <AllianceSuggestions onAllianceClick={onOpenAllianceProfile} onOpenCreate={handleOpenCreate} />
                    </div>
                </div>
            </div>
        );
    }

    const isLeader = currentUser.uid === playerAlliance.leader.uid;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return <AllianceOverview />;
            case 'members': return <AllianceMembers />;
            case 'research': return <AllianceResearch />;
            case 'diplomacy': return <AllianceDiplomacy />;
            case 'bank': return <AllianceBank />;
            case 'properties': return <AllianceProperties onClose={onClose} />;
            case 'settings': return <AllianceSettings alliance={playerAlliance} isLeader={isLeader} />;
            case 'invitations': return <AllianceInvitations alliance={playerAlliance} isLeader={isLeader} />;
            case 'ranks': return <AllianceRanks alliance={playerAlliance} isLeader={isLeader} />;
            default: return <AllianceOverview />;
        }
    };

    return (
        <div 
            className="alliance-modal" 
            ref={modalRef}
            style={{ 
                position: 'fixed', 
                top: `${position.y}px`, 
                left: `${position.x}px`,
                zIndex: 50 
            }}
            onClick={e => e.stopPropagation()}
        >
            <div className="alliance-modal-header" onMouseDown={handleMouseDown}>
                <div>
                    <h2 className="text-2xl font-bold text-white">{playerAlliance.name}</h2>
                    <p className="text-gray-300">[{playerAlliance.tag}]</p>
                </div>
                <button onClick={onClose} className="close-button">&times;</button>
            </div>
            
            <div className="alliance-modal-tabs">
                <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
                <button onClick={() => setActiveTab('members')} className={activeTab === 'members' ? 'active' : ''}>Members</button>
                <button onClick={() => setActiveTab('research')} className={activeTab === 'research' ? 'active' : ''}>Research</button>
                <button onClick={() => setActiveTab('diplomacy')} className={activeTab === 'diplomacy' ? 'active' : ''}>Diplomacy</button>
                <button onClick={() => setActiveTab('bank')} className={activeTab === 'bank' ? 'active' : ''}>Bank</button>
                <button onClick={() => setActiveTab('properties')} className={activeTab === 'properties' ? 'active' : ''}>Properties</button>
                {isLeader && (
                    <>
                        <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>Settings</button>
                        <button onClick={() => setActiveTab('invitations')} className={activeTab === 'invitations' ? 'active' : ''}>Invitations</button>
                        <button onClick={() => setActiveTab('ranks')} className={activeTab === 'ranks' ? 'active' : ''}>Ranks</button>
                    </>
                )}
            </div>
            
            <div className="alliance-modal-content">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default AllianceModal;