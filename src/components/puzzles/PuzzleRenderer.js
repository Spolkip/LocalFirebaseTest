// src/components/puzzles/PuzzleRenderer.js
import React, { useState, useEffect } from 'react';
import puzzles from '../../gameData/puzzles.json';

const PuzzleRenderer = ({ puzzleId, onSolve }) => {
    const [puzzle, setPuzzle] = useState(null);
    const [answer, setAnswer] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (puzzles[puzzleId]) {
            setPuzzle(puzzles[puzzleId]);
        }
    }, [puzzleId]);

    const handleSubmit = () => {
        if (answer.toLowerCase().trim() === puzzle.answer.toLowerCase().trim()) {
            setMessage('Correct! The way is open.');
            onSolve();
        } else {
            setMessage('Incorrect. The guardians ponder your answer...');
        }
    };

    if (!puzzle) {
        return <div>Loading puzzle...</div>;
    }

    return (
        <div className="p-4 bg-black/10 rounded mt-4">
            <p className="italic">"{puzzle.question}"</p>
            <div className="flex mt-4">
                <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your answer..."
                />
                <button onClick={handleSubmit} className="btn btn-primary ml-2">Submit</button>
            </div>
            {message && <p className="text-center mt-2">{message}</p>}
        </div>
    );
};

export default PuzzleRenderer;
