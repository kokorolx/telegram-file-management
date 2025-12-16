'use client';

export default function ViewToggle({ view, onChange }) {
  return (
    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 rounded-md transition-all ${
          view === 'grid'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
        }`}
        title="Grid View"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 rounded-md transition-all ${
          view === 'list'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
        }`}
        title="List View"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}
