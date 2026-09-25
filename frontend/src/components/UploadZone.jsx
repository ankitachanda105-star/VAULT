import React, { useState } from 'react';
import { UploadCloud, Layers } from 'lucide-react';

export function UploadZone({ onUpload, isUploading }) {
  const [replicationFactor, setReplicationFactor] = useState(3);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files[0], replicationFactor);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0], replicationFactor);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[#121820] border border-slate-800/80 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-emerald-400" />
          <span>Upload Object with Replication</span>
        </h3>

        {/* Replication Factor Picker */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-sans">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Replicas:</span>
          <select
            value={replicationFactor}
            onChange={(e) => setReplicationFactor(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
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
        className={`relative border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60'
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
        <UploadCloud className={`w-8 h-8 mb-2 transition-transform ${isDragOver ? 'scale-110 text-emerald-400' : 'text-slate-500'}`} />
        <div className="text-xs text-slate-300 font-medium">
          {isUploading ? 'Replicating bytes across cluster...' : 'Drop file here or click to browse'}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Distributes copies across {replicationFactor} distinct online nodes with SHA-256 verification
        </div>
      </div>
    </div>
  );
}
