import React from 'react';

const Modal = ({ message, title, children, onClose }) => {
    // Render nothing if no message, title, or children are provided
    if (!message && !title && !children) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={onClose} // Close modal on backdrop click
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600"
                onClick={e => e.stopPropagation()} // Prevent modal from closing when clicking inside it
            >
                {title && <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">{title}</h2>}
                {message && <p className="mb-4 text-lg text-gray-300">{message}</p>}
                {children} {/* Render children passed to the modal */}
                <button
                    onClick={onClose}
                    className="btn btn-primary px-6 py-2 mt-4"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default Modal;
