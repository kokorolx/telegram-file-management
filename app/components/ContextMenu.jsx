'use client';

import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    // Close on escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent scrolling when menu is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  // Adjust position to keep in viewport
  // We can't do this perfectly without measuring first, but CSS can help
  const style = {
    top: y,
    left: x,
  };

  // Basic viewport check logic could go here if needed

  return (
    <div
      className="fixed z-[100] inset-0"
      onContextMenu={(e) => {
          e.preventDefault();
          onClose(); // Close if clicking background via right click
      }}
    >
      {/* Invisible backdrop to catch clicks */}
      {/* <div className="absolute inset-0" onClick={onClose} /> */}

      <div
        ref={menuRef}
        style={style}
        className="absolute w-56 bg-white/90 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] overflow-hidden animate-fade-in origin-top-left flex flex-col py-1.5"
      >
        {items.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="h-px bg-gray-200 my-1.5 mx-2" />;
          }

          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
              className={`text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors mx-1 rounded-lg
                ${item.danger
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }
              `}
            >
              {item.icon && <span className="text-lg opacity-75">{item.icon}</span>}
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
