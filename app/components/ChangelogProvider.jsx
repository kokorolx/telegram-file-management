'use client';

import { useChangelogModal } from '@/lib/hooks/useChangelogModal';
import ChangelogModal from './ChangelogModal';

/**
 * ChangelogProvider Component
 * 
 * Wraps the app to display changelog modal on new releases
 * Should be placed near the root of the app
 */
export function ChangelogProvider({ children }) {
  const { isOpen, onClose, changelog, version, loading } = useChangelogModal();

  // Don't render modal while loading
  if (loading) {
    return children;
  }

  return (
    <>
      {children}
      <ChangelogModal 
        isOpen={isOpen} 
        onClose={onClose} 
        changelog={changelog} 
        version={version}
      />
    </>
  );
}
