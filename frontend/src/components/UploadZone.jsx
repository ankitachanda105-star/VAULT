import React, { useState } from 'react';
import { UploadCloud, Layers } from 'lucide-react';

export function UploadZone({ onUpload, isUploading }) {
  const [replicationFactor, setReplicationFactor] = useState(3);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justDropped, setJustDropped] = useState(false);

  const triggerUploadWithFeedback = (file) => {
    setJustDropped(true);
    setTimeout(() => setJustDropped(false), 500);
    onUpload(file, replicationFactor);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      triggerUploadWithFeedback(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      triggerUploadWithFeedback(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="glass-panel p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-cyan-400" />
          <span>Upload Object with Replication</span>
        </h3>

        {/* Replication Factor Picker */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-sans">
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span>Replicas:</span>
          <select
            value={replicationFactor}
            onChange={(e) => setReplicationFactor(Number(e.target.value))}
            className="bg-[#0c1118] border border-[var(--line)] rounded-lg px-2.5 py-0.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/60"
          >
            <option value="1">1x (Single)</option>
            <option value="2">2x (Dual)</option>
            <option value="3">3x (Standard Quorum)</option>
            <option value="4">4x (High)</option>
            <option value="5">5x (All Nodes)</option>
          </select>
        </div>
      </div>

      {/* Drag & Drop Target */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
          justDropped
            ? 'border-cyan-300 bg-cyan-400/20 shadow-[0_0_35px_rgba(34,211,238,0.4)] scale-[1.01]'
            : isDragOver
            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_rgba(34,211,238,0.25)]'
            : 'border-cyan-500/25 hover:border-cyan-400/60 bg-[#0c1118]/60 hover:bg-cyan-500/[0.04]'
        }`}
        onClick={() => document.getElementById('file-upload-input')?.click()}
      >
        <input
          id="file-upload-input"
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-2">
          <UploadCloud className={`w-6 h-6 transition-transform duration-200 ${isDragOver ? 'scale-110' : ''}`} />
        </div>
        <div className="text-xs text-slate-200 font-medium font-sans">
          {isUploading ? (
            <span className="text-cyan-300 animate-pulse">Replicating bytes across cluster...</span>
          ) : (
            <span>Drop file here or click to browse</span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-1 font-sans">
          Distributes copies across <span className="text-cyan-400 font-mono font-medium">{replicationFactor}</span> distinct online nodes with SHA-256 verification
        </div>
      </div>
    </div>
  );
}
