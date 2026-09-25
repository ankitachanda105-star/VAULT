import React from 'react';
import { Database, HardDrive, ShieldCheck, Activity, Wifi, WifiOff, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export function TopBar({ nodes, summary, wsConnected, isPanelOpen, setIsPanelOpen }) {
  const totalUsed = nodes.reduce((acc, n) => acc + (n.used_storage || 0), 0);
  const totalStorage = nodes.reduce((acc, n) => acc + (n.total_storage || 10737418240), 0);
  const storagePct = totalStorage > 0 ? Math.min(100, Math.round((totalUsed / totalStorage) * 100)) : 0;

  // Calculate health percentage: online nodes / total nodes + healthy objects
  const totalNodes = summary.total_nodes || 5;
  const onlineNodes = summary.online ?? 5;
  const totalObjects = summary.total_objects || 0;
  const healthyObjects = summary.healthy_objects || 0;
  
  const healthPct = totalObjects > 0
    ? Math.round((healthyObjects / totalObjects) * 100)
    : (onlineNodes === totalNodes ? 100 : Math.round((onlineNodes / totalNodes) * 100));

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0a0e14]/90 backdrop-blur-md px-6 flex items-center justify-between select-none z-30">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Database className="w-5 h-5 text-emerald-400" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-base text-slate-100 tracking-wide font-sans">VAULT</h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">LIVING CLUSTER</span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans">Distributed Object-Storage System</p>
        </div>
      </div>

      {/* Metrics Center */}
      <div className="hidden lg:flex items-center gap-8">
        {/* Total Objects */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800/60 text-slate-400">
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Total Objects</div>
            <div className="text-sm font-semibold font-mono text-slate-100">{summary.total_objects || 0}</div>
          </div>
        </div>

        {/* Storage Used */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800/60 text-slate-400">
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider font-medium">
              <span>Cluster Storage</span>
              <span className="text-slate-500 font-mono">({storagePct}%)</span>
            </div>
            <div className="text-sm font-semibold font-mono text-slate-100">
              {formatBytes(totalUsed)} <span className="text-slate-500 text-xs font-normal">/ {formatBytes(totalStorage)}</span>
            </div>
          </div>
        </div>

        {/* Target Replication Factor */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800/60 text-slate-400">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Replication Factor</div>
            <div className="text-sm font-semibold font-mono text-emerald-400">3x <span className="text-slate-500 text-xs font-normal font-sans">Quorum</span></div>
          </div>
        </div>

        {/* Healthy Replicas % */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800/60 text-slate-400">
            <ShieldCheck className={`w-4 h-4 ${healthPct === 100 ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Cluster Health</div>
            <div className={`text-sm font-semibold font-mono ${healthPct === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {healthPct}% <span className="text-slate-500 text-xs font-normal font-sans">{summary.failed > 0 ? `(${summary.failed} Failed)` : 'Optimal'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* WebSocket Status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
          wsConnected
            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
            : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
        }`}>
          {wsConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
          <span>{wsConnected ? 'LIVE FEED' : 'RECONNECTING'}</span>
        </div>

        {/* Collapse Sidebar Button */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          title={isPanelOpen ? "Expand Graph to Full-Width" : "Open Feed & Tables Panel"}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 hover:text-white transition-colors"
        >
          {isPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
