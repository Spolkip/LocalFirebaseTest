import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';

const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600 text-white">
            <p className="mb-6 text-lg">{message}</p>
            <div className="flex justify-center space-x-4">
                <button onClick={onCancel} className="btn btn-primary">Cancel</button>
                <button onClick={onConfirm} className="btn btn-danger">Confirm</button>
            </div>
        </div>
    </div>
);

const AllianceProperties = ({ onClose }) => {
    const { playerAlliance, leaveAlliance, disbandAlliance } = useAlliance();
    const { currentUser } = useAuth();
    const [confirmAction, setConfirmAction] = useState(null);

    const isLeader = currentUser?.uid === playerAlliance?.leader?.uid;
    const isLastMember = playerAlliance?.members?.length === 1;

    const handleLeave = () => {
        setConfirmAction({
            message: "Are you sure you want to leave this alliance?",
            action: async () => {
                try {
                    await leaveAlliance();
                    onClose();
                } catch (error) {
                    console.error(error);
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };
    
    const handleDisband = () => {
        setConfirmAction({
            message: "Are you sure you want to disband the alliance? This action is permanent and cannot be undone.",
            action: async () => {
                try {
                    await disbandAlliance();
                    onClose();
                } catch (error) {
                    console.error(error);
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    return (
        <div className="p-4 alliance-bg-light alliance-text-light rounded-lg">
            {confirmAction && (
                <ConfirmationModal 
                    message={confirmAction.message}
                    onConfirm={confirmAction.action}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <h3 className="text-xl font-bold mb-4">Alliance Properties</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-lg mb-2">Leave Alliance</h4>
                    <p className="text-sm text-gray-400 mb-2">
                        {isLeader && !isLastMember 
                            ? "As the leader, you must pass leadership to another member before you can leave."
                            : "If you leave, you will need to be invited or apply to join another alliance."
                        }
                    </p>
                    <button 
                        onClick={handleLeave} 
                        className="btn btn-danger"
                        disabled={isLeader && !isLastMember}
                    >
                        {isLeader && isLastMember ? 'Leave and Disband' : 'Leave Alliance'}
                    </button>
                </div>
                {isLeader && (
                    <div className="border-t border-gray-600 pt-4">
                        <h4 className="font-semibold text-lg mb-2 text-red-400">Disband Alliance</h4>
                        <p className="text-sm text-gray-400 mb-2">
                            This will permanently delete the alliance for all members. This action cannot be undone.
                        </p>
                        <button onClick={handleDisband} className="btn btn-danger">Disband Alliance</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllianceProperties;