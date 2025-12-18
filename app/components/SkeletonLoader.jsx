'use client';

export function FileCardSkeleton() {
  return (
    <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-3 h-full flex flex-col animate-pulse">
      {/* Thumbnail Area */}
      <div className="relative aspect-[4/3] mb-3 bg-gray-200 rounded-xl overflow-hidden" />
      
      {/* Title */}
      <div className="space-y-2 mt-auto">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-2 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export function FolderCardSkeleton() {
  return (
    <div className="group relative bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-sm animate-pulse">
      {/* Icon */}
      <div className="flex justify-center mb-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
      </div>
      
      {/* Name */}
      <div className="space-y-2 text-center">
        <div className="h-3 bg-gray-200 rounded w-4/5 mx-auto" />
        <div className="h-2 bg-gray-100 rounded w-3/5 mx-auto" />
      </div>
    </div>
  );
}

export function FileListSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {[...Array(10)].map((_, i) => (
        <FileCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FileListSkeletonRow() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-3 bg-gray-50 border-b border-gray-200">
        <div className="w-10 h-5 bg-gray-200 rounded" />
        <div className="flex-1 h-5 bg-gray-200 rounded" />
        <div className="w-24 h-5 bg-gray-200 rounded" />
        <div className="w-28 h-5 bg-gray-200 rounded hidden sm:block" />
        <div className="w-16 h-5 bg-gray-200 rounded" />
      </div>
      
      <div className="divide-y divide-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-100 rounded" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-24 h-4 bg-gray-100 rounded" />
            <div className="w-28 h-4 bg-gray-100 rounded hidden sm:block" />
            <div className="w-16 h-8 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
