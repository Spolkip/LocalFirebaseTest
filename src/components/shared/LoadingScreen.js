import React from 'react';

/**
 * A simple loading screen component.
 * @param {object} props - The component props.
 * @param {string} [props.message='Loading...'] - The message to display below the spinner.
 * @returns {JSX.Element} The rendered loading screen.
 */
const LoadingScreen = ({ message = 'Loading...' }) => {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            {/* A simple CSS spinner */}
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-lg font-semibold">{message}</p>
        </div>
    );
};

export default LoadingScreen;
