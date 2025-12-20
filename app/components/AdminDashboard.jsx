'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { config } from '@/lib/config';

export default function AdminDashboardClient({ initialLogs }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('health');

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/doctor');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 h-full w-64 bg-[#111] border-r border-white/5 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">🔐</div>
            <h1 className="font-bold text-lg tracking-tight">Admin Console</h1>
        </div>

        <div className="flex flex-col gap-2">
            <button
                onClick={() => setActiveTab('health')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'health' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span>📊</span> System Health
            </button>
            {config.isEnterprise && (
              <>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'logs' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    <span>📜</span> Audit Logs
                </button>
                <button
                    onClick={() => setActiveTab('jobs')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'jobs' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    <span>⚙️</span> Video Jobs
                </button>
              </>
            )}
        </div>

        <div className="mt-auto">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white transition">
                <span>←</span> Back to Vault
            </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 p-12">
        <header className="mb-12 flex items-center justify-between">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold">
                    {activeTab === 'health' && 'System Infrastructure'}
                    {activeTab === 'logs' && 'Security Audit Trail'}
                    {activeTab === 'jobs' && 'Background Processing'}
                </h2>
                <p className="text-gray-500 font-medium">
                    {config.isEnterprise ? 'Monitoring your enterprise-grade vault.' : 'Monitoring your system infrastructure.'}
                </p>
            </div>
            <button
                onClick={fetchHealth}
                className="px-6 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition text-sm font-bold"
            >
                Refresh Data
            </button>
        </header>

        {activeTab === 'health' && (
            <div className="space-y-10">
                {/* Health Overview */}
                <div className="grid grid-cols-3 gap-8">
                    {[
                        { label: 'Database', status: health?.diagnostics?.health?.database, icon: '🗄️' },
                        { label: 'Redis Engine', status: health?.diagnostics?.health?.redis, icon: '⚡' },
                        { label: 'Video Worker', status: health?.diagnostics?.health?.worker === 'ONLINE' ? 'UP' : 'DOWN', icon: '📹' }
                    ].map((item, i) => (
                        <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2rem] space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-3xl">{item.icon}</span>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${item.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {item.status || 'CHECKING...'}
                                </div>
                            </div>
                            <h3 className="text-lg font-bold">{item.label}</h3>
                        </div>
                    ))}
                </div>

                {/* Capability Matrix */}
                <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10">
                    <h3 className="text-xl font-bold mb-8">System Capabilities Check</h3>
                    <div className="grid gap-6">
                        {[
                            { name: 'File Matrix Upload', cap: health?.diagnostics?.can_upload, desc: 'Primary database connectivity for metadata management.' },
                            { name: 'HA Session Management', cap: health?.diagnostics?.can_use_sessions, desc: 'Shared Redis store for multi-server availability.' },
                            { name: '4K Video Transcoding', cap: health?.diagnostics?.can_process_video, desc: 'Background workers and processing queue status.' }
                        ].map((cap, i) => (
                            <div key={i} className="flex items-center justify-between py-6 border-b border-white/5 last:border-0">
                                <div className="space-y-1">
                                    <p className="font-bold text-lg">{cap.name}</p>
                                    <p className="text-sm text-gray-500">{cap.desc}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${cap.cap ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {cap.cap ? '✓' : '✗'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'logs' && (
            <div className="bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold">Activity Feed</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Showing {initialLogs?.length || 0} recent actions</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                            <tr>
                                <th className="px-8 py-4">Action</th>
                                <th className="px-8 py-4">Resource</th>
                                <th className="px-8 py-4">User</th>
                                <th className="px-8 py-4">IP Address</th>
                                <th className="px-8 py-4">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {initialLogs && initialLogs.length > 0 ? initialLogs.map((log, i) => (
                                <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${log.action.includes('DELETE') ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                                            <span className="font-bold text-sm tracking-tight">{log.action}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-1 rounded">{log.resource_type}: {log.resource_id?.substring(0, 8)}...</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-sm font-medium">{log.user_id?.substring(0, 8)}...</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs text-gray-500 font-mono">{log.ip_address || 'N/A'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-xs text-gray-500 text-right tabular-nums">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-gray-500 italic">No activity logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'jobs' && (
            <div className="space-y-10">
                <div className="grid grid-cols-4 gap-8">
                    {[
                        { label: 'Active', count: health?.diagnostics?.queue?.active, color: 'blue' },
                        { label: 'Waiting', count: health?.diagnostics?.queue?.waiting, color: 'purple' },
                        { label: 'Completed', count: health?.diagnostics?.queue?.completed, color: 'emerald' },
                        { label: 'Failed', count: health?.diagnostics?.queue?.failed, color: 'red' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2rem] space-y-2">
                             <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                             <p className={`text-4xl font-extrabold text-${stat.color}-400`}>{stat.count ?? 0}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10">
                    <h3 className="text-xl font-bold mb-8">Queue Status Details</h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between py-4 border-b border-white/5">
                            <span className="text-gray-400">Worker Status</span>
                            <span className={`font-bold ${health?.diagnostics?.health?.worker === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {health?.diagnostics?.health?.worker || 'UNKNOWN'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-4 border-b border-white/5">
                            <span className="text-gray-400">Delayed Jobs</span>
                            <span className="font-bold">{health?.diagnostics?.queue?.delayed ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between py-4 border-b border-white/5">
                            <span className="text-gray-400">Redis Connection</span>
                            <span className={`font-bold ${health?.diagnostics?.health?.redis === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {health?.diagnostics?.health?.redis || 'OFFLINE'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
