'use client';

import { useState, useEffect } from 'react';
import { shouldShowChangelog, markChangelogAsSeen } from '@/lib/changelogParser';

/**
 * Hook to manage changelog modal display
 * 
 * Automatically fetches latest changelog and tracks seen versions
 * Shows modal once per new release
 * 
 * @returns {Object} { isOpen, onClose, changelog, version, loading, error }
 */
export function useChangelogModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [changelog, setChangelog] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndShowChangelog = async () => {
      try {
        setLoading(true);

        // Fetch latest changelog from API
        const response = await fetch('/api/changelog');
        
        if (!response.ok) {
          // No changelog available, that's ok
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        if (data.success && data.version && data.html) {
          setVersion(data.version);
          setChangelog(data.html);

          // Check if we should show this version
          if (shouldShowChangelog(data.version)) {
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch changelog:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndShowChangelog();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    
    // Mark version as seen
    if (version) {
      markChangelogAsSeen(version);
    }
  };

  return {
    isOpen,
    onClose: handleClose,
    changelog,
    version,
    loading,
    error
  };
}
