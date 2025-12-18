'use client';

import { useEffect, useRef } from 'react';

export default function SimpleContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  const style = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 230),
  };

  return (
    <div
      className="fixed z-[100] inset-0"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        style={style}
        className="absolute w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-fade-in"
      >
        {items.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="h-px bg-gray-200 my-1" />;
          }

          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick?.();
                onClose();
              }}
              disabled={item.disabled}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                ${item.disabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : item.danger
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }
              `}
            >
              {item.icon && <span className="text-base">{item.icon}</span>}
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
