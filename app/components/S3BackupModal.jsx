'use client';

import { useState, useEffect } from 'react';

const S3_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-west-2', label: 'EU (London)' },
  { value: 'eu-west-3', label: 'EU (Paris)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'eu-north-1', label: 'EU (Stockholm)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'Asia Pacific (Osaka)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'me-south-1', label: 'Middle East (Bahrain)' },
  { value: 'af-south-1', label: 'Africa (Cape Town)' },
];

const S3_STORAGE_CLASSES = {
  S3: [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'INTELLIGENT_TIERING', label: 'Intelligent-Tiering' },
    { value: 'STANDARD_IA', label: 'Standard-IA (Infrequent Access)' },
    { value: 'ONEZONE_IA', label: 'One Zone-IA' },
    { value: 'GLACIER_IR', label: 'Glacier Instant Retrieval' },
  ],
  R2: [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'STANDARD_IA', label: 'Infrequent Access' },
  ],
};

export default function S3BackupModal({ isOpen, onClose }) {
  const [provider, setProvider] = useState('S3');
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [config, setConfig] = useState({
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    storageClass: 'STANDARD',
  });

  const [masterPassword, setMasterPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [buckets, setBuckets] = useState([]);
  const [testStatus, setTestStatus] = useState(null); // 'success' | 'error' | null

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus(null);
    setError('');
    setBuckets([]);

    try {
      const res = await fetch('/api/settings/backup/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: config.endpoint,
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          bucket: config.bucket,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');

      setTestStatus('success');
      if (data.buckets) {
        setBuckets(data.buckets);
      }
    } catch (err) {
      setTestStatus('error');
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkExistingConfig();
    }
  }, [isOpen]);

  // Sync region and storage class when provider changes
  useEffect(() => {
    if (provider === 'R2') {
      setConfig(prev => ({
        ...prev,
        region: 'auto',
        storageClass: 'STANDARD'
      }));
    } else if (provider === 'S3') {
      setConfig(prev => ({
        ...prev,
        region: prev.region === 'auto' ? 'us-east-1' : prev.region,
        storageClass: 'STANDARD'
      }));
    }
  }, [provider]);

  const checkExistingConfig = async () => {
    try {
      const res = await fetch('/api/settings/backup');
      const data = await res.json();
      setHasExistingConfig(data.hasBackupConfig);

      // If we have existing data but it's not pre-filled (some implementations might return partial data),
      // we could pre-fill it here if the API provided the non-sensitive parts.
      // For now, we just know if it exists.
    } catch (err) {
      console.error('Failed to check backup config:', err);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/settings/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPassword,
          config: {
            ...config,
            provider,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      setSuccess('Backup configuration saved successfully!');
      setHasExistingConfig(true);
      setMasterPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your backup configuration?')) return;

    setLoading(true);
    try {
      await fetch('/api/settings/backup', { method: 'DELETE' });
      setHasExistingConfig(false);
      setSuccess('Backup configuration removed');
      setConfig({
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        storageClass: 'STANDARD',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-lg w-full p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">☁️ Backup Storage Configuration</h2>

        {/* Warning Banner */}
        <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-3 mb-4">
          <p className="text-amber-200 text-sm">
            ⚠️ <strong>Warning:</strong> Your backup credentials are encrypted with your Master Password.
            If you lose your Master Password, these credentials <strong>cannot be recovered</strong>.
          </p>
        </div>

        {hasExistingConfig && (
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 mb-4">
            <p className="text-green-200 text-sm">✅ You have a backup configuration saved.</p>
          </div>
        )}

        {/* Provider Selection */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="S3">AWS S3</option>
            <option value="R2">Cloudflare R2</option>
            <option value="CUSTOM">Custom S3-Compatible</option>
          </select>
        </div>

        {/* Endpoint (for R2 or Custom) */}
        {(provider === 'R2' || provider === 'CUSTOM') && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">Endpoint URL</label>
            <input
              type="text"
              value={config.endpoint}
              onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
              placeholder="https://your-account-id.r2.cloudflarestorage.com"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        )}

        {/* Region */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Region</label>
          {provider === 'R2' ? (
            <div className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-slate-400">
              auto <span className="text-xs text-slate-500">(R2 is globally distributed)</span>
            </div>
          ) : provider === 'S3' ? (
            <select
              value={config.region}
              onChange={(e) => setConfig({ ...config, region: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            >
              {S3_REGIONS.map((region) => (
                <option key={region.value} value={region.value}>{region.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.region}
              onChange={(e) => setConfig({ ...config, region: e.target.value })}
              placeholder="us-east-1"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            />
          )}
        </div>


        {/* Access Key */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Access Key ID</label>
          <input
            type="text"
            value={config.accessKeyId}
            onChange={(e) => setConfig({ ...config, accessKeyId: e.target.value })}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        {/* Secret Key */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Secret Access Key</label>
          <input
            type="password"
            value={config.secretAccessKey}
            onChange={(e) => setConfig({ ...config, secretAccessKey: e.target.value })}
            placeholder="••••••••••••••••"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !config.accessKeyId || !config.secretAccessKey}
            className={`w-full py-2 px-4 rounded font-medium transition-all flex items-center justify-center gap-2 ${
              testStatus === 'success'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
            }`}
          >
            {testing ? '⏳ Testing...' : testStatus === 'success' ? '✅ Connection Verified' : '🔍 Test Connection'}
          </button>
        </div>

        {/* Bucket Name */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Bucket Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.bucket}
              onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
              placeholder="my-backup-bucket"
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            />
            {buckets.length > 0 && (
              <select
                onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
                value={config.bucket}
                className="w-48 bg-gray-800 border border-emerald-500/50 rounded px-3 py-2 text-white animate-fade-in"
              >
                <option value="">Choose...</option>
                {buckets.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>
          {buckets.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1">Select from account or type manually</p>
          )}
        </div>

        {/* Storage Class */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Storage Class</label>
          <select
            value={config.storageClass}
            onChange={(e) => setConfig({ ...config, storageClass: e.target.value })}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          >
            {(S3_STORAGE_CLASSES[provider] || S3_STORAGE_CLASSES.S3).map((cls) => (
              <option key={cls.value} value={cls.value}>{cls.label}</option>
            ))}
          </select>
        </div>

        {/* Master Password */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Master Password (to encrypt config)</label>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder="Enter your master password"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        {/* Error/Success Messages */}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-400 text-sm mb-4">{success}</p>}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading || !masterPassword || !config.bucket}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded font-medium"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
          {hasExistingConfig && (
            <button
              onClick={handleRemove}
              disabled={loading}
              className="px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
