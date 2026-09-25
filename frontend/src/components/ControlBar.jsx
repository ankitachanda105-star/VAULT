import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Zap, Wrench, Play, Scale, X, ArrowRight } from 'lucide-react';
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
  const [partitionNodeId, setPartitionNodeId] = useState('');
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
    <div className="bg-[#121820] border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Cluster Controls & Resilience Testing
          </h3>
        </div>
        {rebalanceData && (
          <button
            onClick={onClearRebalance}
            className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Close Rebalance View
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-xs">
        {/* 1. Simulate Failure */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 font-medium text-rose-400 mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Node Outage</span>
          </div>
          <div className="flex gap-1.5">
            <select
              value={failNodeId}
              onChange={(e) => setFailNodeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none"
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
              className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 disabled:opacity-40 text-white font-medium rounded transition-colors whitespace-nowrap"
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
              className="px-2 py-1 bg-purple-600/80 hover:bg-purple-600 disabled:opacity-40 text-white font-medium rounded transition-colors whitespace-nowrap"
            >
              Partition
            </button>
          </div>
        </div>

        {/* 2. Recover Node */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400 mb-2">
            <RefreshCw className="w-4 h-4" />
            <span>Recover Node</span>
          </div>
          <div className="flex gap-1.5">
            <select
              value={recoverNodeId}
              onChange={(e) => setRecoverNodeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none"
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
              className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white font-medium rounded transition-colors whitespace-nowrap"
            >
              Heal
            </button>
          </div>
        </div>

        {/* 3. Simulate Corruption */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 font-medium text-amber-400 mb-2">
            <Zap className="w-4 h-4" />
            <span>Inject Bit Rot</span>
          </div>
          <div className="flex gap-1">
            <select
              value={corruptObjId}
              onChange={(e) => setCorruptObjId(e.target.value)}
              className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 py-1 text-slate-200 font-mono text-[11px] focus:outline-none"
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
              className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 py-1 text-slate-200 font-mono text-[11px] focus:outline-none"
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
              className="px-2 py-1 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 text-white font-medium rounded transition-colors whitespace-nowrap"
            >
              Rot
            </button>
          </div>
        </div>

        {/* 4. Manual Self-Healing Trigger */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 font-medium text-sky-400 mb-2">
            <Wrench className="w-4 h-4" />
            <span>Cluster Healing</span>
          </div>
          <button
            onClick={onManualRepair}
            className="w-full py-1 bg-sky-600/80 hover:bg-sky-600 text-white font-medium rounded transition-colors flex items-center justify-center gap-1"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Trigger Repair</span>
          </button>
        </div>

        {/* 5. Storage Rebalance */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 font-medium text-indigo-400 mb-2">
            <Scale className="w-4 h-4" />
            <span>Storage Rebalance</span>
          </div>
          <button
            onClick={handleRebalanceClick}
            disabled={isRebalancing}
            className="w-full py-1 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium rounded transition-colors flex items-center justify-center gap-1"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isRebalancing ? 'Balancing...' : 'Rebalance'}</span>
          </button>
        </div>
      </div>

      {/* Inline Before/After Horizontal Bar Chart */}
      {rebalanceData && (
        <div className="mt-2 p-3 bg-slate-950/80 border border-indigo-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-xs">Rebalance Storage Snapshot</span>
              {rebalanceData.objects_moved && rebalanceData.objects_moved.length > 0 ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                  Moved {rebalanceData.objects_moved.length} object(s): {rebalanceData.objects_moved.map(m => `${m.object_name} (${m.from_node} → ${m.to_node})`).join(', ')}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400">Cluster already balanced</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Before */}
            <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold mb-2">Before Rebalance</div>
              <div className="space-y-1.5">
                {rebalanceData.before?.map((n) => {
                  const maxStorage = Math.max(...rebalanceData.before.map(x => x.used_storage), 1);
                  const pct = Math.min(100, Math.round((n.used_storage / maxStorage) * 100));
                  return (
                    <div key={`b-${n.node_name}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-12 text-slate-400">{n.node_name}:</span>
                      <div className="flex-1 bg-slate-800 h-2 rounded overflow-hidden">
                        <div className="bg-amber-500/70 h-full rounded" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right text-slate-300">{formatBytes(n.used_storage)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* After */}
            <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
              <div className="text-emerald-400 text-[10px] uppercase font-bold mb-2">After Rebalance</div>
              <div className="space-y-1.5">
                {rebalanceData.after?.map((n) => {
                  const maxStorage = Math.max(...rebalanceData.after.map(x => x.used_storage), 1);
                  const pct = Math.min(100, Math.round((n.used_storage / maxStorage) * 100));
                  return (
                    <div key={`a-${n.node_name}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-12 text-slate-400">{n.node_name}:</span>
                      <div className="flex-1 bg-slate-800 h-2 rounded overflow-hidden">
                        <div className="bg-emerald-500/70 h-full rounded" style={{ width: `${pct}%` }} />
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
