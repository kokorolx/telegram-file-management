'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { formatFileSize } from '@/lib/utils';

export default function BotManager() {
  const [bots, setBots] = useState([]);
  const [botStats, setBotStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', botToken: '', tgUserId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/bots');
      if (!res.ok) throw new Error('Failed to fetch bots');
      const data = await res.json();
      setBots(data.bots || []);

      // Fetch stats for each bot
      if (data.bots && data.bots.length > 0) {
        const statsMap = {};
        for (const bot of data.bots) {
          const statsRes = await fetch(`/api/settings/bots/${bot.id}/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            statsMap[bot.id] = statsData.stats;
          }
        }
        setBotStats(statsMap);
      }

      setError(null);
    } catch (err) {
      console.error('Fetch bots error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async (e) => {
    e.preventDefault();
    if (!formData.botToken || !formData.tgUserId) {
      setError('Bot token and User ID are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/settings/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to add bot');

      setFormData({ name: '', botToken: '', tgUserId: '' });
      setShowAddForm(false);
      setError(null);
      await fetchBots();
    } catch (err) {
      console.error('Add bot error:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBot = async (botId) => {
    const bot = bots.find(b => b.id === botId);
    const stats = botStats[botId];
    const fileCount = stats?.files_count || 0;

    let message = `Delete bot "${bot.name}"?`;
    if (fileCount > 0) {
      message += `\n\nWarning: ${fileCount} file parts are stored with this bot and may not be downloadable after deletion.`;
    }

    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/settings/bots/${botId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete bot');
      setError(null);
      await fetchBots();
    } catch (err) {
      console.error('Delete bot error:', err);
      setError(err.message);
    }
  };

  const handleSetDefault = async (botId) => {
    try {
      const res = await fetch(`/api/settings/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });

      if (!res.ok) throw new Error('Failed to set default bot');
      setError(null);
      await fetchBots();
    } catch (err) {
      console.error('Set default bot error:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading bots...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bot Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No bots configured yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Bot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bots.map(bot => {
            const stats = botStats[bot.id] || { files_count: 0, total_size: 0, uploads_count: 0 };
            return (
              <div key={bot.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{bot.name}</h3>
                      {bot.is_default && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mb-4 break-all">
                      Token: {bot.bot_token.substring(0, 20)}...
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-600">Files</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.files_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Size</p>
                        <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.total_size || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Uploads</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.uploads_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!bot.is_default && (
                      <button
                        onClick={() => handleSetDefault(bot.id)}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setFormData({ name: '', botToken: '', tgUserId: '' });
          setError(null);
        }}
        title="Add New Bot"
      >
        <form onSubmit={handleAddBot} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bot Name (Optional)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., My Bot"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bot Token *
            </label>
            <input
              type="password"
              value={formData.botToken}
              onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
              placeholder="Paste your bot token from @BotFather"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Get it from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telegram User ID *
            </label>
            <input
              type="text"
              value={formData.tgUserId}
              onChange={(e) => setFormData({ ...formData, tgUserId: e.target.value })}
              placeholder="Your Telegram user ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Get it from @userinfobot on Telegram</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormData({ name: '', botToken: '', tgUserId: '' });
              }}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Bot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
