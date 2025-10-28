import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile as firebaseUpdateProfile, sendEmailVerification, reload } from 'firebase/auth';
import { auth } from './firebase';
import { clearUserData } from '../utils';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email} (${user.uid})` : 'No user');
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  
  const logout = async () => {
    try {
      // Just sign out - keep user data for when they log back in
      await signOut(auth);
    } catch (error) {
      console.warn('Error during logout:', error);
      await signOut(auth);
    }
  };

  const updateProfile = (profile) => {
    if (!auth.currentUser) throw new Error('No user logged in');
    return firebaseUpdateProfile(auth.currentUser, profile).then(() => {
      setUser({ ...auth.currentUser, ...profile });
    });
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No user logged in');
    await sendEmailVerification(auth.currentUser);
  };

  const reloadUser = async () => {
    if (!auth.currentUser) throw new Error('No user logged in');
    await reload(auth.currentUser);
    // Refresh local user state with the latest emailVerified flag
    setUser({ ...auth.currentUser });
    return auth.currentUser;
  };

  // Social sign-in removed per user request

  const value = { 
    user, 
    userId: user?.uid || null,
    login, 
    register, 
    logout, 
    updateProfile,
    sendVerificationEmail,
    reloadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 