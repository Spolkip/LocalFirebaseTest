import React, { useRef, useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import './TextEditor.css';

// #comment Input component for BBCode mentions with autocomplete
const MentionInput = ({ type, data, onSelect, onClose, buttonRef }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const popupRef = useRef(null);
    const inputRef = useRef(null);

    // #comment Position the popup relative to the button that opened it
    const popupStyle = () => {
        if (!buttonRef) return {};
        const rect = buttonRef.getBoundingClientRect();
        return {
            top: `${rect.bottom + window.scrollY + 5}px`,
            left: `${rect.left + window.scrollX}px`,
        };
    };

    // #comment Filter suggestions based on user input for players, cities, and alliances
    useEffect(() => {
        if (type === 'player' || type === 'city' || type === 'alliance') {
            if (inputValue.length > 0) {
                const filtered = data.filter(item => item.toLowerCase().startsWith(inputValue.toLowerCase()));
                setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
            } else {
                setSuggestions([]);
            }
        }
    }, [inputValue, data, type]);

    // #comment Focus the input field when the popup opens
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // #comment Close the popup if the user clicks outside of it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleSubmit = (value) => {
        if (value.trim()) {
            onSelect(value.trim());
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(inputValue);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div ref={popupRef} className="mention-input-popup" style={popupStyle()}>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Enter ${type} name...`}
                className="mention-input"
            />
            {(type === 'player' || type === 'city' || type === 'alliance') && suggestions.length > 0 && (
                <ul className="mention-suggestions">
                    {suggestions.map(item => (
                        <li key={item} onClick={() => handleSubmit(item)}>
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// #comment Cache for editor autocomplete data to reduce reads.
const editorDataCache = {
    players: null,
    cities: null,
    alliances: null,
    timestamp: 0,
};


// #comment The main text editor component
const TextEditor = ({ value, onChange }) => {
    const { worldId } = useGame();
    const textareaRef = useRef(null);
    const [showColors, setShowColors] = useState(false);
    const [mentionState, setMentionState] = useState({ visible: false, type: null, buttonRef: null });

    const [players, setPlayers] = useState([]);
    const [cities, setCities] = useState([]);
    const [alliances, setAlliances] = useState([]);

    // #comment Fetch players, cities, and alliances for autocomplete, using a cache.
    useEffect(() => {
        if (!worldId) return;

        const fetchData = async () => {
            const now = Date.now();
            const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

            if (now - editorDataCache.timestamp < CACHE_DURATION && editorDataCache.players) {
                setPlayers(editorDataCache.players);
                setCities(editorDataCache.cities);
                setAlliances(editorDataCache.alliances);
                return;
            }

            // Fetch all data in parallel if cache is stale
            const usersRef = collection(db, 'users');
            const citiesRef = collection(db, 'worlds', worldId, 'citySlots');
            const alliancesRef = collection(db, 'worlds', worldId, 'alliances');

            const playersQuery = getDocs(usersRef);
            const citiesQuery = getDocs(query(citiesRef, where("ownerId", "!=", null)));
            const alliancesQuery = getDocs(alliancesRef);

            const [playersSnapshot, citiesSnapshot, alliancesSnapshot] = await Promise.all([
                playersQuery,
                citiesQuery,
                alliancesQuery
            ]);

            const playersData = playersSnapshot.docs.map(doc => doc.data().username);
            const citiesData = citiesSnapshot.docs.map(doc => doc.data().cityName);
            const alliancesData = alliancesSnapshot.docs.map(doc => doc.data().name);

            setPlayers(playersData);
            setCities(citiesData);
            setAlliances(alliancesData);

            // Update cache
            editorDataCache.players = playersData;
            editorDataCache.cities = citiesData;
            editorDataCache.alliances = alliancesData;
            editorDataCache.timestamp = now;
        };

        fetchData();
    }, [worldId]);

    const applyFormat = (tag, param = '') => {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        let selectedText = value.substring(start, end);
        
        // #comment If no text is selected, use the parameter as the content
        if (!selectedText && param) {
            selectedText = param;
        }

        let openTag = `[${tag}${param && tag !== 'url' ? `=${param}` : ''}]`;
        if (tag === 'url' && param) {
            openTag = `[url=${selectedText}]`;
            selectedText = param; // The param becomes the display text
        }

        const closeTag = `[/${tag}]`;
        const newText = `${value.substring(0, start)}${openTag}${selectedText}${closeTag}${value.substring(end)}`;
        
        onChange(newText);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + openTag.length + selectedText.length + closeTag.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };
    
    const handleColorClick = (color) => {
        applyFormat('color', color);
        setShowColors(false);
    };

    const handleMentionButtonClick = (type, e) => {
        setMentionState({
            visible: true,
            type: type,
            buttonRef: e.currentTarget,
        });
    };

    const handleMentionSelect = (name) => {
        applyFormat(mentionState.type, name);
        setMentionState({ visible: false, type: null, buttonRef: null });
    };
    
    const colors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

    return (
        <div className="text-editor-container">
             {mentionState.visible && (
                <MentionInput
                    type={mentionState.type}
                    data={
                        mentionState.type === 'player' ? players :
                        mentionState.type === 'city' ? cities :
                        mentionState.type === 'alliance' ? alliances : []
                    }
                    onSelect={handleMentionSelect}
                    onClose={() => setMentionState({ visible: false, type: null, buttonRef: null })}
                    buttonRef={mentionState.buttonRef}
                />
            )}
            <div className="editor-toolbar">
                <button type="button" onClick={() => applyFormat('b')} className="toolbar-btn" title="Bold">B</button>
                <button type="button" onClick={() => applyFormat('i')} className="toolbar-btn italic" title="Italic">I</button>
                <button type="button" onClick={() => applyFormat('u')} className="toolbar-btn underline" title="Underline">U</button>
                <button type="button" onClick={() => applyFormat('spoiler')} className="toolbar-btn" title="Spoiler">S</button>
                <div className="relative">
                    <button type="button" onClick={() => setShowColors(!showColors)} className="toolbar-btn" title="Text Color">A</button>
                    {showColors && (
                        <div className="color-palette">
                            {colors.map(color => (
                                <button key={color} type="button" onClick={() => handleColorClick(color)} className="color-swatch" style={{ backgroundColor: color }} />
                            ))}
                        </div>
                    )}
                </div>
                <button type="button" onClick={() => applyFormat('size', '10')} className="toolbar-btn" title="Font Size">Size</button>
                <button type="button" onClick={() => applyFormat('img')} className="toolbar-btn" title="Image">Img</button>
                <button type="button" onClick={() => applyFormat('url', 'Link Text')} className="toolbar-btn" title="URL">URL</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('player', e)} className="toolbar-btn" title="Player">P</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('alliance', e)} className="toolbar-btn" title="Alliance">A</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('city', e)} className="toolbar-btn" title="City">C</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('island', e)} className="toolbar-btn" title="Island">I</button>
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="editor-textarea"
            />
        </div>
    );
};

export default TextEditor;
