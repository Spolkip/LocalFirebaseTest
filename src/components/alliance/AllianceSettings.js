import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import TextEditor from '../shared/TextEditor';

const AllianceSettings = ({ alliance, onClose, updateSettings, isLeader }) => {
    const { updateAllianceSettings } = useAlliance();
    const [name, setName] = useState(alliance.name);
    const [description, setDescription] = useState(alliance.settings.description);
    const [privateDescription, setPrivateDescription] = useState(alliance.settings.privateDescription || '');
    const [status, setStatus] = useState(alliance.settings.status);
    const [message, setMessage] = useState('');
    const handleSave = () => {
        if (!isLeader) return;
        if (name.trim() === '' || description.trim() === '') {
            setMessage('Name and description cannot be empty.');
            return;
        }

        updateAllianceSettings({
            name,
            description,
            privateDescription,
            status,
        });
        setMessage('Settings saved successfully!');
    };

    const getStatusBadge = () => {
        switch(status) {
            case 'open': return <span className="status-badge status-open">Open</span>;
            case 'invite_only': return <span className="status-badge status-invite_only">Invite Only</span>;
            case 'closed': return <span className="status-badge status-closed">Closed</span>;
            default: return null;
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-section">
                <h3>Alliance Information</h3>
                <div className="form-group">
                    <label>Alliance Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="settings-input"
                        disabled={!isLeader}
                    />
                </div>

                <div className="form-group">
                    <label>Alliance Description (Public)</label>
                    <TextEditor value={description} onChange={setDescription} disabled={!isLeader} />
                </div>
                 <div className="form-group">
                    <label>Alliance Description (Private)</label>
                    <TextEditor value={privateDescription} onChange={setPrivateDescription} disabled={!isLeader} />
                </div>
            </div>

            <div className="settings-section">
                <h3>Membership Settings</h3>
                    <div className="form-group">
                        <label>Alliance Status {getStatusBadge()}</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="settings-input alliance-text-dark alliance-bg-dark"
                            disabled={!isLeader}>
                        <option value="open">Open (Anyone can join)</option>
                        <option value="invite_only">Invite Only (Join by invite or application)</option>
                        <option value="closed">Closed (Join by invite only)</option>
                    </select>
                </div>
            </div>

            {message && (
                <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {isLeader && (
                <div className="actions">
                    <button onClick={handleSave} className="save-button">
                        Save Settings
                    </button>
                </div>
            )}
        </div>
    );
};

export default AllianceSettings;
