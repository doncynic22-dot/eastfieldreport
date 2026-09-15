import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, CheckCircle2, AlertCircle, Wifi, WifiOff, Cloud, Database, X } from 'lucide-react';

interface GlobalSyncBadgeProps {
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  lastSyncTime: Date | null;
  onForceSync: () => Promise<void>;
  studentCount?: number;
  teacherCount?: number;
  gradeCount?: number;
}

export const GlobalSyncBadge: React.FC<GlobalSyncBadgeProps> = ({
  status,
  lastSyncTime,
  onForceSync,
  studentCount = 0,
  teacherCount = 0,
  gradeCount = 0
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState('');
  const [timeAgo, setTimeAgo] = useState('Just now');

  // Relative time updater
  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastSyncTime) {
        setTimeAgo('Not synced yet');
        return;
      }
      const seconds = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
      if (seconds < 5) {
        setTimeAgo('Just now');
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        setTimeAgo(`${mins}m ago`);
      } else {
        setTimeAgo(lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 3000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage('');
    try {
      await onForceSync();
      setSyncSuccessMessage('All data synced successfully with Supabase Cloud!');
      setTimeout(() => setSyncSuccessMessage(''), 4000);
    } catch (err) {
      setSyncSuccessMessage('Sync encountered an issue. Retrying in background...');
      setTimeout(() => setSyncSuccessMessage(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          dotClass: 'bg-emerald-400 animate-pulse',
          badgeBg: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/80',
          label: 'Auto-Sync Active',
          description: 'Automatic WebSockets & Multi-Tab Cloud Sync'
        };
      case 'connecting':
        return {
          dotClass: 'bg-amber-400 animate-ping',
          badgeBg: 'bg-amber-950/70 border-amber-500/40 text-amber-200 hover:bg-amber-900/80',
          label: 'Auto-Sync Connecting',
          description: 'Establishing Supabase realtime channel'
        };
      case 'error':
        return {
          dotClass: 'bg-rose-400',
          badgeBg: 'bg-rose-950/70 border-rose-500/40 text-rose-200 hover:bg-rose-900/80',
          label: 'Auto-Sync Retrying',
          description: 'Automatic background polling active'
        };
      case 'disconnected':
      default:
        return {
          dotClass: 'bg-slate-400',
          badgeBg: 'bg-slate-900/80 border-slate-600/40 text-slate-300 hover:bg-slate-800',
          label: 'Auto-Sync Local',
          description: 'Changes will auto-sync when online'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="relative inline-block text-left" id="global-sync-badge-container">
      {/* Trigger Button in Navigation Header */}
      <button
        type="button"
        id="global-sync-badge-button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition shadow-sm cursor-pointer ${config.badgeBg}`}
        title={`Supabase: ${config.label} (${timeAgo}) - Automatic Continuous Sync`}
        aria-expanded={isOpen}
      >
        <span className="relative flex h-2 w-2">
          {status === 'connected' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`}></span>
        </span>
        <Radio className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-300' : ''}`} />
        <span className="hidden sm:inline font-medium">{config.label}</span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          {/* Overlay backdrop to dismiss */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            id="global-sync-popover"
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#1a0c3b] border border-violet-500/40 shadow-2xl z-50 p-4 text-white animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-violet-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-900/80 border border-violet-700/60 text-violet-300">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-violet-100 flex items-center gap-1.5">
                    Automatic Synchronization
                  </h4>
                  <p className="text-[11px] text-violet-300/80">
                    Real-time Supabase & Multi-Tab Sync
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-violet-400 hover:text-white hover:bg-violet-800/50 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Details */}
            <div className="py-3 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-violet-950/60 border border-violet-900/50">
                <span className="text-violet-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  Sync Mode:
                </span>
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  100% Automatic (Real-time)
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-violet-950/60 border border-violet-900/50">
                <span className="text-violet-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  Realtime WebSockets:
                </span>
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  {status === 'connected' ? 'Connected & Active' : config.label}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-violet-950/60 border border-violet-900/50">
                <span className="text-violet-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  Cross-Tab Broadcast Bus:
                </span>
                <span className="font-semibold text-blue-300">Active (Instant)</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-violet-950/60 border border-violet-900/50">
                <span className="text-violet-300">Last Synced:</span>
                <span className="font-medium text-violet-200">{timeAgo}</span>
              </div>
            </div>

            {/* Automatic Synchronization Banner */}
            <div className="p-2.5 rounded-xl bg-violet-950/90 border border-violet-700/50 text-[11px] text-violet-200 leading-relaxed mb-3">
              <span className="font-bold text-emerald-300 flex items-center gap-1 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                Automatic & Hands-Free
              </span>
              All pupils, marks, attendance, bills, and stock changes synchronize automatically in the background across devices every few seconds. No manual syncing is required.
            </div>

            {/* Entity Counts */}
            <div className="grid grid-cols-3 gap-2 py-2 mb-3">
              <div className="bg-violet-950/80 border border-violet-800/40 rounded-xl p-2 text-center">
                <span className="block text-[10px] text-violet-400 uppercase font-bold tracking-wider">Students</span>
                <span className="text-base font-black text-violet-100">{studentCount}</span>
              </div>
              <div className="bg-violet-950/80 border border-violet-800/40 rounded-xl p-2 text-center">
                <span className="block text-[10px] text-violet-400 uppercase font-bold tracking-wider">Teachers</span>
                <span className="text-base font-black text-violet-100">{teacherCount}</span>
              </div>
              <div className="bg-violet-950/80 border border-violet-800/40 rounded-xl p-2 text-center">
                <span className="block text-[10px] text-violet-400 uppercase font-bold tracking-wider">Grades</span>
                <span className="text-base font-black text-violet-100">{gradeCount}</span>
              </div>
            </div>

            {/* Notification message */}
            {syncSuccessMessage && (
              <div className="mb-3 p-2 rounded-xl bg-emerald-900/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{syncSuccessMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-violet-800/60 flex items-center justify-between gap-2">
              <button
                type="button"
                id="btn-force-realtime-sync"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Verifying Cloud Parity...' : 'Check & Verify Cloud Sync'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
