import React from 'react';
import { Database, HardDrive, ShieldCheck, Activity, Wifi, WifiOff, PanelRightClose, PanelRightOpen, Server } from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { CircularProgress } from './CircularProgress';

export function TopBar({ nodes, summary, wsConnected, isPanelOpen, setIsPanelOpen }) {
  const totalUsed = nodes.reduce((acc, n) => acc + (n.used_storage || 0), 0);
  const totalStorage = nodes.reduce((acc, n) => acc + (n.total_storage || 10737418240), 0);
  const storagePct = totalStorage > 0 ? Math.min(100, Math.round((totalUsed / totalStorage) * 100)) : 0;

  const totalNodes = summary.total_nodes || 5;
  const onlineNodes = summary.online ?? nodes.filter(n => n.status === 'ONLINE').length;
  const totalObjects = summary.total_objects || 0;
  const healthyObjects = summary.healthy_objects || 0;
  
  const healthPct = totalObjects > 0
    ? Math.round((healthyObjects / totalObjects) * 100)
    : (onlineNodes === totalNodes ? 100 : Math.round((onlineNodes / totalNodes) * 100));

  const healthColor = healthPct >= 100 ? '#10b981' : healthPct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <header className="h-16 border-b border-[var(--line)] bg-[#0c1118]/85 backdrop-blur-md px-6 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 font-bold shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          <Database className="w-5 h-5 text-cyan-400" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 pulse-dot-cyan"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-lg tracking-wider font-sans vault-gradient-text">
              VAULT
            </h1>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-mono font-semibold tracking-wider">
              LIVING CLUSTER
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans tracking-tight">
            Fault-Tolerant Distributed Object Storage
          </p>
        </div>
      </div>

      {/* Metrics Center */}
      <div className="hidden lg:flex items-center gap-7">
        {/* Live Nodes */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-800/40 border border-[var(--line)] text-slate-400">
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-medium">Nodes Online</div>
            <div className="text-sm font-semibold font-mono text-slate-100">
              {onlineNodes} <span className="text-slate-500 text-xs font-normal">/ {totalNodes}</span>
            </div>
          </div>
        </div>

        {/* Total Objects */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-800/40 border border-[var(--line)] text-slate-400">
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-medium">Total Objects</div>
            <div className="text-sm font-semibold font-mono text-slate-100">{totalObjects}</div>
          </div>
        </div>

        {/* Storage Used */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-800/40 border border-[var(--line)] text-slate-400">
            <HardDrive className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-sans font-medium">
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
          <div className="p-1.5 rounded-lg bg-slate-800/40 border border-[var(--line)] text-slate-400">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-medium">Replication Factor</div>
            <div className="text-sm font-semibold font-mono text-cyan-400">
              3x <span className="text-slate-500 text-xs font-normal font-sans">Quorum</span>
            </div>
          </div>
        </div>

        {/* Cluster Durability & Health with Circular Progress Ring */}
        <div className="flex items-center gap-3 pl-2 border-l border-[var(--line)]">
          <CircularProgress value={healthPct} size={36} color={healthColor} strokeWidth={3.5} />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-medium">Cluster Durability</div>
            <div className="text-xs font-medium font-sans text-slate-300">
              {summary.failed > 0 ? (
                <span className="text-rose-400 font-mono font-semibold">{summary.failed} Node Outage</span>
              ) : healthPct >= 100 ? (
                <span className="text-emerald-400 font-mono font-semibold">100% Optimal</span>
              ) : (
                <span className="text-amber-400 font-mono font-semibold">Degraded Quorum</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* WebSocket Status with Cyan Pulse-Dot Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
          wsConnected
            ? 'bg-cyan-500/[0.12] text-cyan-300 border-cyan-500/30'
            : 'bg-rose-500/[0.12] text-rose-300 border-rose-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected ? 'bg-cyan-400 pulse-dot-cyan' : 'bg-rose-400 pulse-dot-bad'}`} />
          <span>{wsConnected ? 'LIVE FEED' : 'RECONNECTING'}</span>
        </div>

        {/* Collapse Sidebar Button */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          title={isPanelOpen ? "Expand Graph to Full-Width" : "Open Feed & Tables Panel"}
          className="p-2 rounded-xl bg-slate-800/40 hover:bg-slate-700/50 border border-[var(--line)] text-slate-300 hover:text-white transition-colors"
        >
          {isPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
