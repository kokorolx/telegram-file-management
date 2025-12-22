'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = 'bg-black/60 backdrop-blur-sm',
  showCloseButton = false
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Lock body scroll when modal is open
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }

    return () => {
        document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 animate-fade-in ${backdropClassName}`}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-700 z-10 ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {showCloseButton && (
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-20"
            >
                ✕
            </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
