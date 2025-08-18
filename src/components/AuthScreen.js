import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from '../firebase/config';
import Modal from './shared/Modal';
import EyeIcon from './icons/EyeIcon';
import EyeOffIcon from './icons/EyeOffIcon';
import './AuthScreen.css';

const AuthScreen = () => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');

    // Form states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerUsername, setRegisterUsername] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

    const validateRegistration = () => {
        if (!registerUsername || !registerEmail || !registerPassword || !registerConfirmPassword) {
            setMessage("All fields are required.");
            return false;
        }
        if (registerPassword !== registerConfirmPassword) {
            setMessage("Passwords do not match.");
            return false;
        }
        if (registerPassword.length < 6) {
            setMessage("Password must be at least 6 characters long.");
            return false;
        }
        if (registerUsername.length < 3) {
            setMessage("Username must be at least 3 characters long.");
            return false;
        }
        return true;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        } catch (error) {
            setMessage("Failed to login. Please check your email and password.");
            console.error(error);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!validateRegistration()) return;
        setMessage('');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                username: registerUsername,
                email: user.email,
                is_admin: false
            });
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                setMessage("An account with this email already exists.");
            } else {
                setMessage(error.message);
            }
            console.error(error);
        }
    };

    const togglePasswordVisibility = () => setShowPassword(!showPassword);

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4 perspective auth-screen-container">
            <Modal message={message} onClose={() => setMessage('')} />
            <div className={`auth-card ${isFlipped ? 'flipped' : ''}`}>
                {/* Front Side: Login */}
                <div className="auth-card-face auth-card-front">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                        <h1 className="font-title text-4xl text-center text-gray-300 mb-8">Age of Nasos</h1>
                        <h2 className="text-2xl font-bold text-center text-white mb-6">Login</h2>
                        <form onSubmit={handleLogin}>
                            <div className="mb-4">
                                <label className="block text-gray-400 mb-2">Email</label>
                                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <div className="mb-6 relative">
                                <label className="block text-gray-400 mb-2">Password</label>
                                <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                <button type="button" onClick={togglePasswordVisibility} className="absolute right-3 top-10 text-gray-400 hover:text-white">
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                            <button type="submit" className="w-full btn btn-primary font-bold py-3 rounded-lg">Enter the Realm</button>
                        </form>
                        <p className="text-center text-gray-400 mt-6">
                            Don't have an account? <button onClick={() => setIsFlipped(true)} className="text-blue-400 hover:underline">Register here</button>
                        </p>
                    </div>
                </div>

                {/* Back Side: Register */}
                <div className="auth-card-face auth-card-back">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                        <h1 className="font-title text-4xl text-center text-gray-300 mb-8">Age of Nasos</h1>
                        <h2 className="text-2xl font-bold text-center text-white mb-6">Register</h2>
                        <form onSubmit={handleRegister}>
                             <div className="mb-4">
                                <label className="block text-gray-400 mb-2">Username</label>
                                <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-400 mb-2">Email</label>
                                <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <div className="mb-4 relative">
                                <label className="block text-gray-400 mb-2">Password</label>
                                <input type={showPassword ? 'text' : 'password'} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                 <button type="button" onClick={togglePasswordVisibility} className="absolute right-3 top-10 text-gray-400 hover:text-white">
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                             <div className="mb-6">
                                <label className="block text-gray-400 mb-2">Confirm Password</label>
                                <input type={showPassword ? 'text' : 'password'} value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <button type="submit" className="w-full btn btn-primary font-bold py-3 rounded-lg">Forge Your Empire</button>
                        </form>
                        <p className="text-center text-gray-400 mt-6">
                            Already have an account? <button onClick={() => setIsFlipped(false)} className="text-blue-400 hover:underline">Login here</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
