'use client';

import { useState, useEffect } from 'react';

let cachedFlags = null;

/**
 * Hook to access feature flags on the client
 * Fetches from /api/features and caches the result
 * 
 * @returns {Object} { recoveryCodesEnabled, recoveryCodesBeta, recoveryCodesRolloutPercent, loading }
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState(cachedFlags || {
    recoveryCodesEnabled: false,
    recoveryCodesBeta: false,
    recoveryCodesRolloutPercent: 0,
    loading: true
  });

  useEffect(() => {
    if (cachedFlags) {
      setFlags(cachedFlags);
      return;
    }

    const fetchFlags = async () => {
      try {
        const response = await fetch('/api/features');
        if (response.ok) {
          const data = await response.json();
          cachedFlags = { ...data, loading: false };
          setFlags(cachedFlags);
        }
      } catch (err) {
        console.error('Failed to fetch feature flags:', err);
        setFlags(prev => ({ ...prev, loading: false }));
      }
    };

    fetchFlags();
  }, []);

  return flags;
}
