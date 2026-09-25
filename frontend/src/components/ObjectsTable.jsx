import React, { useState } from 'react';
import { Database, Download, Trash2, CheckCircle2, ShieldAlert, History, X } from 'lucide-react';
import { formatBytes, truncateHash } from '../utils/formatters';
import { fetchObjectVersions } from '../services/api';

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
    <div className="relative flex flex-col h-full bg-[#121820] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Cluster Object Catalog
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
          {objects.length} stored
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {objects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
            <Database className="w-6 h-6 mb-2 stroke-1 opacity-60" />
            <span>No objects uploaded yet</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-mono tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Object</th>
                <th className="py-2.5 px-2">Size</th>
                <th className="py-2.5 px-2">Checksum</th>
                <th className="py-2.5 px-2">Replicas</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {objects.map((obj) => {
                const isOptimal = (obj.live_replicas || 0) >= (obj.replication_factor || 3);
                return (
                  <tr key={obj.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-100 truncate max-w-[130px]" title={obj.object_name}>
                          {obj.object_name}
                        </span>
                        <span className="px-1.5 py-0.2 bg-sky-950/60 text-sky-400 border border-sky-500/30 rounded font-mono text-[9px] font-bold">
                          v{obj.version || 1}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {obj.id}</div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-400">
                      {formatBytes(obj.size)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-400">
                      <span title={obj.checksum}>{truncateHash(obj.checksum, 5)}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isOptimal
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {obj.live_replicas || 0} / {obj.replication_factor || 3}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase font-mono ${
                        obj.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {obj.status === 'healthy' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{obj.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Version History */}
                        <button
                          onClick={() => handleOpenVersions(obj)}
                          title="View Version History"
                          className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-sky-300 transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Download */}
                        <button
                          onClick={() => onDownload(obj.id, obj.object_name)}
                          title="Download Object"
                          className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Verify */}
                        <button
                          onClick={() => onVerify(obj.id)}
                          disabled={verifyingId === obj.id}
                          title="Verify Replicas Integrity & Auto-Heal"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
                        >
                          {verifyingId === obj.id ? 'Checking...' : 'Verify'}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(obj.id)}
                          title="Delete Object"
                          className="p-1 hover:bg-rose-950/40 rounded text-slate-400 hover:text-rose-400 transition-colors"
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
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-20 flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-semibold text-slate-100">
                Versions for <span className="font-mono text-sky-400">{selectedVersionObj.object_name}</span>
              </h4>
            </div>
            <button
              onClick={() => setSelectedVersionObj(null)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingVersions ? (
              <div className="text-slate-400 text-xs text-center py-6">Loading version history...</div>
            ) : versionHistory.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">No versions recorded</div>
            ) : (
              <div className="space-y-2">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.version}
                    className={`p-2.5 rounded-lg border text-xs ${
                      ver.status === 'live'
                        ? 'bg-sky-950/20 border-sky-500/40 text-slate-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          ver.status === 'live'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          v{ver.version}
                        </span>
                        <span className={`text-[10px] uppercase font-mono font-semibold ${
                          ver.status === 'live' ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {ver.status}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ver.created_at ? new Date(ver.created_at).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500">Hash: </span>
                        <span>{truncateHash(ver.checksum, 6)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Replicas: </span>
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
