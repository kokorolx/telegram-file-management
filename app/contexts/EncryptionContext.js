'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearSecureCache } from '@/lib/secureImageCache';
import { deriveEncryptionKeyBrowser } from '@/lib/clientDecryption';
import { useUser } from './UserContext';

const EncryptionContext = createContext();

export function EncryptionProvider({ children }) {
  const { user } = useUser();
  const [masterPassword, setMasterPassword] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [salt, setSalt] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const lock = useCallback(() => {
    setMasterPassword(null);
    setEncryptionKey(null);
    setSalt(null);
    setIsUnlocked(false);
    clearSecureCache();
  }, []);

  // Auto-lock on logout
  useEffect(() => {
    if (!user && isUnlocked) {
      lock();
    }
  }, [user, isUnlocked, lock]);

  // ... beforeunload effect ...
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

  const unlock = async (password, userSalt) => {
    try {
      const key = await deriveEncryptionKeyBrowser(password, userSalt);
      setMasterPassword(password);
      setEncryptionKey(key);
      setSalt(userSalt);
      setIsUnlocked(true);
    } catch (err) {
      console.error('Failed to derive encryption key:', err);
      throw err;
    }
  };

  return (
    <EncryptionContext.Provider value={{ masterPassword, encryptionKey, salt, isUnlocked, unlock, lock }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  return useContext(EncryptionContext);
}
