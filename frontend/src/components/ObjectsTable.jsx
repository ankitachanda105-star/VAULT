import React, { useState } from 'react';
import { Database, Download, Trash2, History, X, CheckCircle, ShieldAlert } from 'lucide-react';
import { formatBytes, truncateHash } from '../utils/formatters';
import { fetchObjectVersions } from '../services/api';
import { StatusPill } from './StatusPill';

export function ObjectsTable({ objects, onDownload, onDelete, onVerify, verifyingId }) {
  const [selectedVersionObj, setSelectedVersionObj] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const handleOpenVersions = async (obj) => {
    setSelectedVersionObj(obj);
    setIsLoadingVersions(true);
    try {
      const data = await fetchObjectVersions(obj.id);
      setVersionHistory(data);
    } catch (e) {
      console.error('Failed to load version history:', e);
      setVersionHistory([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  return (
    <div className="relative glass-panel flex flex-col h-full overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-3 border-b border-[var(--line)] flex items-center justify-between bg-[#0c1118]/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Cluster Object Catalog
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/40 px-2.5 py-0.5 rounded-full border border-[var(--line)]">
          {objects.length} stored
        </span>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {objects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
            <Database className="w-6 h-6 mb-2 stroke-1 opacity-50 text-cyan-400" />
            <span className="font-sans">No objects stored in cluster</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-[#0c1118]/90 text-[10px] text-slate-400 uppercase font-mono tracking-wider sticky top-0 border-b border-[var(--line)] backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-3">Object</th>
                <th className="py-2.5 px-2">Size</th>
                <th className="py-2.5 px-2">Checksum</th>
                <th className="py-2.5 px-2">Replicas</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] font-sans">
              {objects.map((obj) => {
                const isOptimal = (obj.live_replicas || 0) >= (obj.replication_factor || 3);
                return (
                  <tr key={obj.id} className="hover:bg-slate-800/20 transition-colors">
                    {/* Object Name & Version */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium font-sans text-slate-100 truncate max-w-[140px]" title={obj.object_name}>
                          {obj.object_name}
                        </span>
                        <span className="px-1.5 py-0.2 bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 rounded-full font-mono text-[9px] font-bold">
                          v{obj.version || 1}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {obj.id}</div>
                    </td>

                    {/* Size */}
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-300">
                      {formatBytes(obj.size)}
                    </td>

                    {/* Checksum */}
                    <td className="py-2.5 px-2 font-mono text-[11px] text-cyan-400/80">
                      <span title={obj.checksum}>{truncateHash(obj.checksum, 5)}</span>
                    </td>

                    {/* Replicas */}
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        isOptimal
                          ? 'bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/25'
                          : 'bg-amber-500/[0.12] text-amber-400 border border-amber-500/25'
                      }`}>
                        {obj.live_replicas || 0} / {obj.replication_factor || 3}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="py-2.5 px-2">
                      <StatusPill status={obj.status} size="xs" />
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Version History */}
                        <button
                          onClick={() => handleOpenVersions(obj)}
                          title="View Version History"
                          className="p-1.5 rounded-lg btn-default text-slate-400 hover:text-cyan-300"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Download */}
                        <button
                          onClick={() => onDownload(obj.id, obj.object_name)}
                          title="Download Object"
                          className="p-1.5 rounded-lg btn-default text-slate-400 hover:text-slate-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Verify / Auto-Heal */}
                        <button
                          onClick={() => onVerify(obj.id)}
                          disabled={verifyingId === obj.id}
                          title="Verify Replicas Integrity & Auto-Heal"
                          className="px-2 py-1 btn-primary rounded-lg text-[10px] font-mono tracking-wider"
                        >
                          {verifyingId === obj.id ? 'Checking...' : 'Verify'}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(obj.id)}
                          title="Delete Object"
                          className="p-1.5 rounded-lg btn-danger text-slate-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Version History Modal / Drawer */}
      {selectedVersionObj && (
        <div className="absolute inset-0 bg-[#07090d]/90 backdrop-blur-md z-20 flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-semibold text-slate-100 font-sans">
                Versions for <span className="font-mono text-cyan-400">{selectedVersionObj.object_name}</span>
              </h4>
            </div>
            <button
              onClick={() => setSelectedVersionObj(null)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingVersions ? (
              <div className="text-slate-400 text-xs text-center py-6 font-sans">Loading version history...</div>
            ) : versionHistory.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6 font-sans">No versions recorded</div>
            ) : (
              <div className="space-y-2">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.version}
                    className={`p-3 rounded-xl border text-xs ${
                      ver.status === 'live'
                        ? 'bg-cyan-500/[0.08] border-cyan-500/30 text-slate-200'
                        : 'bg-[#0c1118]/80 border-[var(--line)] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          ver.status === 'live'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          v{ver.version}
                        </span>
                        <StatusPill status={ver.status === 'live' ? 'ONLINE' : 'DEGRADED'} size="xs" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ver.created_at ? new Date(ver.created_at).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 font-sans">Checksum: </span>
                        <span className="text-cyan-400">{truncateHash(ver.checksum, 6)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 font-sans">Replicas: </span>
                        <span>{ver.live_replicas} / {ver.total_replicas}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
