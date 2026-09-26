import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Zap, Wrench, Play, Scale, X } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export function ControlBar({
  nodes,
  objects,
  onSimulateFailure,
  onRecover,
  onSimulateCorruption,
  onManualRepair,
  onRebalance,
  rebalanceData,
  onClearRebalance,
  onSimulatePartition,
}) {
  const [failNodeId, setFailNodeId] = useState('');
  const [recoverNodeId, setRecoverNodeId] = useState('');
  const [corruptObjId, setCorruptObjId] = useState('');
  const [corruptNodeId, setCorruptNodeId] = useState('');
  const [isRebalancing, setIsRebalancing] = useState(false);

  const onlineNodes = nodes.filter((n) => n.status === 'ONLINE');
  const failedNodes = nodes.filter((n) => n.status === 'FAILED' || n.status === 'PARTITIONED');

  const handleRebalanceClick = async () => {
    try {
      setIsRebalancing(true);
      await onRebalance();
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <div className="glass-panel p-4 shadow-xl flex flex-col gap-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Cluster Controls & Resilience Testing
          </h3>
        </div>
        {rebalanceData && (
          <button
            onClick={onClearRebalance}
            className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Close Rebalance View
          </button>
        )}
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-xs">
        {/* 1. Node Outage / Partition */}
        <div className="p-3 glass-panel-sub flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-rose-400 font-sans">
            <ShieldAlert className="w-4 h-4" />
            <span>Node Outage</span>
          </div>
          <div className="flex gap-1.5">
            <select
              value={failNodeId}
              onChange={(e) => setFailNodeId(e.target.value)}
              className="w-full bg-[#0c1118] border border-[var(--line)] rounded-lg px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Select Node</option>
              {onlineNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.node_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (failNodeId) {
                  onSimulateFailure(Number(failNodeId));
                  setFailNodeId('');
                }
              }}
              disabled={!failNodeId}
              title="Simulate full node failure (offline)"
              className="px-2.5 py-1 btn-danger disabled:opacity-30 font-medium rounded-lg whitespace-nowrap"
            >
              Kill
            </button>
            <button
              onClick={() => {
                if (failNodeId) {
                  onSimulatePartition(Number(failNodeId));
                  setFailNodeId('');
                }
              }}
              disabled={!failNodeId}
              title="Simulate network partition (alive but unreachable)"
              className="px-2.5 py-1 bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:border-violet-400 disabled:opacity-30 font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Partition
            </button>
          </div>
        </div>

        {/* 2. Recover Node */}
        <div className="p-3 glass-panel-sub flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400 font-sans">
            <RefreshCw className="w-4 h-4" />
            <span>Recover Node</span>
          </div>
          <div className="flex gap-1.5">
            <select
              value={recoverNodeId}
              onChange={(e) => setRecoverNodeId(e.target.value)}
              className="w-full bg-[#0c1118] border border-[var(--line)] rounded-lg px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Select Inactive</option>
              {failedNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.node_name} ({n.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (recoverNodeId) {
                  onRecover(Number(recoverNodeId));
                  setRecoverNodeId('');
                }
              }}
              disabled={!recoverNodeId}
              className="px-3 py-1 btn-default disabled:opacity-30 font-medium rounded-lg whitespace-nowrap hover:text-emerald-300 hover:border-emerald-500/40"
            >
              Heal
            </button>
          </div>
        </div>

        {/* 3. Simulate Corruption */}
        <div className="p-3 glass-panel-sub flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-amber-400 font-sans">
            <Zap className="w-4 h-4" />
            <span>Inject Bit Rot</span>
          </div>
          <div className="flex gap-1.5">
            <select
              value={corruptObjId}
              onChange={(e) => setCorruptObjId(e.target.value)}
              className="w-1/2 bg-[#0c1118] border border-[var(--line)] rounded-lg px-1.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Obj</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.object_name.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              value={corruptNodeId}
              onChange={(e) => setCorruptNodeId(e.target.value)}
              className="w-1/2 bg-[#0c1118] border border-[var(--line)] rounded-lg px-1.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.node_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (corruptObjId && corruptNodeId) {
                  onSimulateCorruption(Number(corruptObjId), Number(corruptNodeId));
                  setCorruptObjId('');
                  setCorruptNodeId('');
                }
              }}
              disabled={!corruptObjId || !corruptNodeId}
              className="px-2.5 py-1 btn-warn disabled:opacity-30 font-medium rounded-lg whitespace-nowrap"
            >
              Rot
            </button>
          </div>
        </div>

        {/* 4. Manual Self-Healing Trigger */}
        <div className="p-3 glass-panel-sub flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-cyan-400 font-sans">
            <Wrench className="w-4 h-4" />
            <span>Cluster Healing</span>
          </div>
          <button
            onClick={onManualRepair}
            className="w-full py-1.5 btn-primary font-medium rounded-lg flex items-center justify-center gap-1.5 text-xs font-sans tracking-wide"
          >
            <Wrench className="w-3.5 h-3.5 text-cyan-300" />
            <span>Trigger Repair</span>
          </button>
        </div>

        {/* 5. Storage Rebalance */}
        <div className="p-3 glass-panel-sub flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-violet-400 font-sans">
            <Scale className="w-4 h-4" />
            <span>Storage Rebalance</span>
          </div>
          <button
            onClick={handleRebalanceClick}
            disabled={isRebalancing}
            className="w-full py-1.5 btn-default disabled:opacity-40 font-medium rounded-lg flex items-center justify-center gap-1.5 text-xs font-sans tracking-wide hover:border-violet-500/40"
          >
            <Scale className="w-3.5 h-3.5 text-violet-300" />
            <span>{isRebalancing ? 'Balancing...' : 'Rebalance'}</span>
          </button>
        </div>
      </div>

      {/* Inline Before/After Horizontal Bar Chart */}
      {rebalanceData && (
        <div className="mt-1 p-3.5 glass-panel-sub border border-violet-500/30">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-xs font-sans">Rebalance Storage Snapshot</span>
              {rebalanceData.objects_moved && rebalanceData.objects_moved.length > 0 ? (
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Moved {rebalanceData.objects_moved.length} object(s): {rebalanceData.objects_moved.map(m => `${m.object_name} (Node-${m.from_node_id} → Node-${m.to_node_id})`).join(', ')}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400">Cluster already balanced</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Before */}
            <div className="p-2.5 bg-[#0c1118]/80 rounded-lg border border-[var(--line)]">
              <div className="text-slate-400 text-[10px] uppercase font-bold mb-2 tracking-wider">Before Rebalance</div>
              <div className="space-y-1.5">
                {rebalanceData.before?.map((n) => {
                  const maxStorage = Math.max(...rebalanceData.before.map(x => x.used_storage), 1);
                  const pct = Math.min(100, Math.round((n.used_storage / maxStorage) * 100));
                  return (
                    <div key={`b-${n.node_name}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 text-slate-400">{n.node_name}:</span>
                      <div className="flex-1 bg-slate-800/60 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-400/80 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right text-slate-300">{formatBytes(n.used_storage)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* After */}
            <div className="p-2.5 bg-[#0c1118]/80 rounded-lg border border-[var(--line)]">
              <div className="text-cyan-400 text-[10px] uppercase font-bold mb-2 tracking-wider">After Rebalance</div>
              <div className="space-y-1.5">
                {rebalanceData.after?.map((n) => {
                  const maxStorage = Math.max(...rebalanceData.after.map(x => x.used_storage), 1);
                  const pct = Math.min(100, Math.round((n.used_storage / maxStorage) * 100));
                  return (
                    <div key={`a-${n.node_name}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 text-slate-400">{n.node_name}:</span>
                      <div className="flex-1 bg-slate-800/60 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-400/80 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right text-slate-300">{formatBytes(n.used_storage)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
