'use client';

import { useState, useEffect } from 'react';

export default function ChangelogModal({ isOpen, onClose, changelog, version }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = null;

  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setTimeout(() => {
      setScrolledToBottom(false);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen || !changelog) return null;

  const handleClose = () => {
    if (localStorage) {
      localStorage.setItem('lastSeenChangelogVersion', version || new Date().toISOString());
    }
    onClose();
  };

  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10;
    setScrolledToBottom(isAtBottom);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📢</span>
              <div>
                <h2 className="text-2xl font-bold text-white">What's New</h2>
                {version && <p className="text-blue-100 text-sm">Release {version}</p>}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-blue-500 rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: changelog }}
        />

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          <a
            href="/changelog"
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 text-center"
          >
            Read more
          </a>
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
