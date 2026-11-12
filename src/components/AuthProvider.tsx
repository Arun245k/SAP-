import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Activity, Shield, UserCircle } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isGuest: false,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  continueAsGuest: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setIsGuest(false);
        // Ensure user document exists for data privacy
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: currentUser.email,
            name: currentUser.displayName,
            createdAt: Date.now()
          });
        }
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
    setIsGuest(false);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#02040a] text-cyan-400">
        <Activity className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#02040a] relative overflow-hidden">
        <div className="scanline"></div>
        <div className="absolute inset-0 z-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>
        
        <div className="relative z-10 glass-panel p-8 rounded-2xl border border-white/10 max-w-sm w-full flex flex-col items-center shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-xl">
          <Shield className="w-12 h-12 text-cyan-400 mb-6 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          <h1 className="text-xl font-display font-bold text-slate-100 tracking-widest uppercase mb-2 text-center">NEXUS SECURE LOGIN</h1>
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase text-center mb-8">
            Access strictly restricted to verified operators
          </p>
          <div className="w-full flex flex-col gap-3">
            <button 
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono text-xs tracking-widest rounded-lg border border-cyan-500/50 hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] uppercase"
            >
              Authenticate via Google
            </button>
            <button 
              onClick={continueAsGuest}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 font-mono text-xs tracking-widest rounded-lg border border-white/10 hover:border-white/20 transition-all uppercase"
            >
              <UserCircle size={16} />
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isGuest, loading, signIn, logOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}
