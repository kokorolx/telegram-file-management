'use client';

import { useEffect, useState } from 'react';
import { formatFileSize } from '@/lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [bots, setBots] = useState([]);
  const [botStats, setBotStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [userStatsRes, botsRes] = await Promise.all([
        fetch('/api/stats/user'),
        fetch('/api/settings/bots')
      ]);

      if (!userStatsRes.ok || !botsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const userStatsData = await userStatsRes.json();
      const botsData = await botsRes.json();

      setStats(userStatsData.stats);
      setBots(botsData.bots || []);

      // Fetch stats for each bot
      if (botsData.bots && botsData.bots.length > 0) {
        const botStatsMap = {};
        for (const bot of botsData.bots) {
          const statsRes = await fetch(`/api/settings/bots/${bot.id}/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            botStatsMap[bot.id] = statsData.stats;
          }
        }
        setBotStats(botStatsMap);
      }

      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Error loading dashboard: {error}</p>
      </div>
    );
  }

  const totalSize = stats?.total_size || 0;
  const totalFiles = stats?.total_files || 0;
  const totalUploads = stats?.total_uploads || 0;
  const totalDownloads = stats?.total_downloads || 0;

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Storage Overview</h2>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Used</p>
            <p className="text-2xl font-bold text-blue-600">{formatFileSize(totalSize)}</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Files</p>
          <p className="text-3xl font-bold text-gray-900">{totalFiles}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Uploads</p>
          <p className="text-3xl font-bold text-green-600">{totalUploads}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Downloads</p>
          <p className="text-3xl font-bold text-purple-600">{totalDownloads}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Active Bots</p>
          <p className="text-3xl font-bold text-orange-600">{bots.length}</p>
        </div>
      </div>

      {/* Bot Usage Stats */}
      {bots.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Bot Usage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Bot Name</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">Files</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">Size</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">Uploads</th>
                </tr>
              </thead>
              <tbody>
                {bots.map(bot => {
                  const botData = botStats[bot.id] || { files_count: 0, total_size: 0, uploads_count: 0 };
                  return (
                    <tr key={bot.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-900">{bot.name}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{botData.files_count || 0}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{formatFileSize(botData.total_size || 0)}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{botData.uploads_count || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
