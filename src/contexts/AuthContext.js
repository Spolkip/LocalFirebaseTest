import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            unsubscribeProfile(); 

            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                
                // #comment Update lastLogin timestamp on authentication.
                updateDoc(userDocRef, { lastLogin: serverTimestamp() }).catch(err => {
                    // This might fail if the doc doesn't exist yet, which is fine.
                    if (err.code !== 'not-found') {
                        console.error("Failed to update last login time:", err);
                    }
                });

                setLoading(true);
                unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data());
                    } else {
                        setUserProfile(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user profile:", error);
                    setUserProfile(null);
                    setLoading(false);
                });
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeProfile();
        };
    }, []);

    const updateUserProfile = async (profileData) => {
        if (currentUser) {
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, profileData);
        }
    };

    // #comment Re-authenticates the user before sensitive operations
    const reauthenticate = async (currentPassword) => {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
    };

    // #comment Updates the user's email after re-authentication
    const updateUserEmail = async (currentPassword, newEmail) => {
        if (!currentUser) throw new Error("No user is signed in.");
        await reauthenticate(currentPassword);
        await updateEmail(currentUser, newEmail);
        // Also update the email in the Firestore user profile
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { email: newEmail });
    };

    // #comment Updates the user's password after re-authentication
    const updateUserPassword = async (currentPassword, newPassword) => {
        if (!currentUser) throw new Error("No user is signed in.");
        await reauthenticate(currentPassword);
        await updatePassword(currentUser, newPassword);
    };


    const value = { currentUser, userProfile, loading, updateUserProfile, updateUserEmail, updateUserPassword };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};