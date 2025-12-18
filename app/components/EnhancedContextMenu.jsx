'use client';

import { useState, useEffect, useRef } from 'react';

export default function EnhancedContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [submenu, setSubmenu] = useState(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });
  const submenuRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (submenu) {
          setSubmenu(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose, submenu]);

  // Handle submenu positioning
  const handleMouseEnter = (item, index) => {
    if (item.submenu) {
      const menuItem = menuRef.current?.children[index];
      if (menuItem) {
        const rect = menuItem.getBoundingClientRect();
        setSubmenuPos({
          top: rect.top - 8,
          left: rect.right + 8,
        });
      }
      setSubmenu(item);
    }
  };

  const handleMouseLeave = () => {
    setSubmenu(null);
  };

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
      style={{ pointerEvents: 'auto' }}
    >
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        style={style}
        className="absolute w-56 bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-lg shadow-lg overflow-hidden animate-fade-in origin-top-left flex flex-col py-1"
      >
        {items.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="h-px bg-gray-200 my-1 mx-2" />;
          }

          return (
            <div key={index}>
              <button
                onMouseEnter={() => handleMouseEnter(item, index)}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.submenu) {
                    item.onClick?.();
                    onClose();
                  }
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors
                  ${item.disabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : item.danger
                    ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  }
                `}
                disabled={item.disabled}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-base opacity-75">{item.icon}</span>}
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.submenu && (
                  <span className="text-gray-400 ml-auto">›</span>
                )}
              </button>

              {/* Submenu */}
              {submenu && submenu.label === item.label && item.submenu && (
                <div
                  ref={submenuRef}
                  onClick={(e) => e.stopPropagation()}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    position: 'fixed',
                    top: submenuPos.top,
                    left: submenuPos.left,
                  }}
                  className="w-48 bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-lg shadow-lg overflow-hidden z-[101] animate-fade-in"
                >
                  {item.submenu.map((subitem, sidx) => {
                    if (subitem.type === 'divider') {
                      return <div key={sidx} className="h-px bg-gray-200 my-1 mx-2" />;
                    }

                    return (
                      <button
                        key={sidx}
                        onClick={(e) => {
                          e.stopPropagation();
                          subitem.onClick?.();
                          onClose();
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                          ${subitem.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                          }
                        `}
                        disabled={subitem.disabled}
                      >
                        {subitem.icon && <span className="text-base opacity-75">{subitem.icon}</span>}
                        <span className="font-medium text-sm">{subitem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
