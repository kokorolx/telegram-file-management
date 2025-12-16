'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { clearSecureCache } from '@/lib/secureImageCache'; // Use absolute path alias if possible, or relative

const EncryptionContext = createContext();

export function EncryptionProvider({ children }) {
  const [masterPassword, setMasterPassword] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // We do NOT store this in localStorage/cookie to adhere to "RAM Only"
  // Warn user if they reload page
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isUnlocked) {
        e.preventDefault();
        e.returnValue = 'You will lose your decryption session if you reload.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUnlocked]);

  const unlock = (password) => {
    setMasterPassword(password);
    setIsUnlocked(true);
  };

  const lock = () => {
    setMasterPassword(null);
    setIsUnlocked(false);
    clearSecureCache();
  };

  return (
    <EncryptionContext.Provider value={{ masterPassword, isUnlocked, unlock, lock }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  return useContext(EncryptionContext);
}
