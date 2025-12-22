'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { formatFileSize } from '@/lib/utils';

export default function BotManager() {
  const [bots, setBots] = useState([]);
  const [botStats, setBotStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingBotId, setEditingBotId] = useState(null);
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

  const handleEditBot = (bot) => {
    setEditingBotId(bot.id);
    setFormData({
      name: bot.name || '',
      botToken: '', // Don't prefill for security
      tgUserId: ''
    });
    setShowEditForm(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBotId) return;

    // At least one field must be provided
    if (!formData.name && !formData.botToken && !formData.tgUserId) {
      setError('Please fill in at least one field');
      return;
    }

    try {
      setSubmitting(true);
      const updatePayload = {};
      
      if (formData.name) updatePayload.name = formData.name;
      if (formData.botToken) updatePayload.botToken = formData.botToken;
      if (formData.tgUserId) updatePayload.tgUserId = formData.tgUserId;

      const res = await fetch(`/api/settings/bots/${editingBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) throw new Error('Failed to update bot');

      setFormData({ name: '', botToken: '', tgUserId: '' });
      setEditingBotId(null);
      setShowEditForm(false);
      setError(null);
      await fetchBots();
    } catch (err) {
      console.error('Edit bot error:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading bots...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <span>🤖</span> Bot Management
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="bg-slate-700/50 rounded-xl p-8 text-center border border-slate-600">
          <p className="text-slate-400 mb-4">No bots configured yet</p>
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
              <div key={bot.id} className="bg-slate-700/50 rounded-xl border border-slate-600 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{bot.name}</h3>
                      {bot.is_default && (
                        <span className="px-2 py-1 bg-blue-900/40 text-blue-300 text-xs rounded border border-blue-500/30 font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mb-4 break-all opacity-60">
                      Token: {bot.bot_token.substring(0, 20)}...
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">Files</p>
                        <p className="text-2xl font-bold text-white">{stats.files_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Size</p>
                        <p className="text-2xl font-bold text-white">{formatFileSize(stats.total_size || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Uploads</p>
                        <p className="text-2xl font-bold text-white">{stats.uploads_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditBot(bot)}
                      className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-900/50 transition-colors"
                    >
                      Edit
                    </button>
                    {!bot.is_default && (
                      <button
                        onClick={() => handleSetDefault(bot.id)}
                        className="px-3 py-1 text-sm bg-slate-600 text-slate-200 rounded hover:bg-slate-500 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                      <button
                        onClick={() => handleDeleteBot(bot.id)}
                        className="px-3 py-1 text-sm bg-red-900/30 text-red-400 rounded border border-red-500/30 hover:bg-red-900/50 transition-colors"
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
        className="max-w-md p-6"
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white">Add New Bot</h3>
          <p className="text-slate-400 text-sm">Configure a new Telegram bot for storage.</p>
        </div>

        <form onSubmit={handleAddBot} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bot Name (Optional)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., My Bot"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bot Token *
            </label>
            <input
              type="password"
              value={formData.botToken}
              onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
              placeholder="Paste your bot token from @BotFather"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Get it from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Telegram User ID *
            </label>
            <input
              type="text"
              value={formData.tgUserId}
              onChange={(e) => setFormData({ ...formData, tgUserId: e.target.value })}
              placeholder="Your Telegram user ID"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Get it from @userinfobot on Telegram</p>
          </div>

          <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', botToken: '', tgUserId: '' });
                }}
                className="flex-1 px-4 py-2 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {submitting ? 'Adding...' : 'Add Bot'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setEditingBotId(null);
          setFormData({ name: '', botToken: '', tgUserId: '' });
          setError(null);
        }}
        className="max-w-md p-6"
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white">Edit Bot</h3>
          <p className="text-slate-400 text-sm">Update bot information. Leave fields empty to keep existing values.</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bot Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter new bot name or leave empty"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bot Token
            </label>
            <input
              type="password"
              value={formData.botToken}
              onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
              placeholder="Paste new bot token or leave empty"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Get it from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Telegram User ID
            </label>
            <input
              type="text"
              value={formData.tgUserId}
              onChange={(e) => setFormData({ ...formData, tgUserId: e.target.value })}
              placeholder="Enter new user ID or leave empty"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Get it from @userinfobot on Telegram</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditForm(false);
                setEditingBotId(null);
                setFormData({ name: '', botToken: '', tgUserId: '' });
                setError(null);
              }}
              className="flex-1 px-4 py-2 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
