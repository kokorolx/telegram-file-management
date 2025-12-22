'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasRecoveryCodes, setHasRecoveryCodes] = useState(false);
  const [recoveryCodesEnabled, setRecoveryCodesEnabled] = useState(false);
  const [recoveryCodeStatus, setRecoveryCodeStatus] = useState(null);
  const [loadingRecoveryCodes, setLoadingRecoveryCodes] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Check recovery code status when user changes
  useEffect(() => {
    if (user?.id) {
      checkRecoveryCodeStatus();
    } else {
      setHasRecoveryCodes(false);
      setRecoveryCodesEnabled(false);
      setRecoveryCodeStatus(null);
    }
  }, [user?.id]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkRecoveryCodeStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingRecoveryCodes(true);
      const res = await fetch('/api/auth/recovery-codes');
      if (res.ok) {
        const data = await res.json();
        setRecoveryCodeStatus(data);
        setRecoveryCodesEnabled(data.enabled || false);
        setHasRecoveryCodes(data.enabled && data.codesRemaining > 0);
      }
    } catch (err) {
      console.error('Recovery code status check failed:', err);
    } finally {
      setLoadingRecoveryCodes(false);
    }
  }, [user?.id]);

  const refreshRecoveryCodeStatus = useCallback(async () => {
    await checkRecoveryCodeStatus();
  }, [checkRecoveryCodeStatus]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setHasRecoveryCodes(false);
      setRecoveryCodesEnabled(false);
      setRecoveryCodeStatus(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        logout,
        checkAuth,
        hasRecoveryCodes,
        recoveryCodesEnabled,
        recoveryCodeStatus,
        loadingRecoveryCodes,
        checkRecoveryCodeStatus,
        refreshRecoveryCodeStatus
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
