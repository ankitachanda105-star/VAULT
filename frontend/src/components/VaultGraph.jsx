import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes, formatTime } from '../utils/formatters';
import { StatusPill } from './StatusPill';
import { MeshBackground } from './MeshBackground';
import { Radio, HardDrive, Cpu, Clock, Layers } from 'lucide-react';

export function VaultGraph({ nodes, objects, activeParticles, flashingNodes, repairAuraNodeId }) {
  const width = 800;
  const height = 580;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 205;
  const svgRef = useRef(null);

  // Initial circular topology coordinates
  const [nodePositions, setNodePositions] = useState(() => {
    const posMap = {};
    const total = 5;
    for (let i = 0; i < total; i++) {
      const angle = (i * 2 * Math.PI) / total - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      posMap[i + 1] = { x, y, angle };
    }
    return posMap;
  });

  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Drag interaction handlers
  const handleMouseDown = (nodeId, e) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setNodePositions((prev) => ({
      ...prev,
      [draggedNodeId]: {
        ...prev[draggedNodeId],
        x: Math.max(50, Math.min(width - 50, x)),
        y: Math.max(50, Math.min(height - 50, y)),
      },
    }));
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  const links = useMemo(() => {
    const result = [];
    for (let i = 1; i <= 5; i++) {
      for (let j = i + 1; j <= 5; j++) {
        if (nodePositions[i] && nodePositions[j]) {
          result.push({
            sourceId: i,
            targetId: j,
            x1: nodePositions[i].x,
            y1: nodePositions[i].y,
            x2: nodePositions[j].x,
            y2: nodePositions[j].y,
          });
        }
      }
    }
    return result;
  }, [nodePositions]);

  const getStatusColor = (status, isFlashing) => {
    if (isFlashing) return '#ef4444'; // Red
    if (status === 'REPAIRING') return '#f59e0b'; // Amber
    if (status === 'PARTITIONED') return '#a78bfa'; // Violet
    if (status === 'FAILED') return '#ef4444'; // Red
    return '#10b981'; // Emerald
  };

  const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
  const hoveredNodePos = hoveredNodeId ? nodePositions[hoveredNodeId] : null;

  // Calculate replicas count for hovered node
  const hoveredReplicaCount = useMemo(() => {
    if (!hoveredNode) return 0;
    return objects.filter((o) =>
      o.replicas?.some(
        (r) => r.node_id === hoveredNode.id || r.node_name === hoveredNode.node_name || r === hoveredNode.node_name
      )
    ).length;
  }, [hoveredNode, objects]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {/* Persistent Graph Header with Legend */}
      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-sans font-semibold text-slate-300 uppercase tracking-wider">
            Topology Mesh
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            (Drag nodes to rearrange)
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-1 rounded-full glass-panel-sub text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot-ok" />
            <span className="text-slate-300">HEALTHY</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 pulse-dot-warn" />
            <span className="text-slate-300">DEGRADED / REPAIR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 pulse-dot-violet" />
            <span className="text-slate-300">PARTITION</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 pulse-dot-bad" />
            <span className="text-slate-300">OFFLINE</span>
          </div>
        </div>
      </div>

      {/* Ambient Decorative Mesh Layer behind the 5 real nodes */}
      <MeshBackground opacity={0.35} />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full max-w-[850px] max-h-[600px] z-10"
      >
        <defs>
          <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-violet" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Central Core Ingestion Hub */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          <circle r="26" fill="#0c1118" stroke="#22d3ee" strokeWidth="1.5" opacity="0.8" />
          <circle r="22" fill="#131a24" opacity="0.6" />
          <circle r="6" fill="#22d3ee" opacity="0.9">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="r" values="5;7;5" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <text textAnchor="middle" dy="38" fill="#64748b" className="text-[10px] font-mono tracking-widest uppercase select-none">
            Ingest Core
          </text>
        </g>

        {/* Hub to Node Spoke Lines */}
        {Object.entries(nodePositions).map(([id, pos]) => (
          <line
            key={`spoke-${id}`}
            x1={centerX}
            y1={centerY}
            x2={pos.x}
            y2={pos.y}
            stroke="rgba(148, 163, 184, 0.15)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Intersite Mesh Interconnect Topology Lines */}
        {links.map((link) => {
          const sourceNode = nodes.find((n) => n.id === link.sourceId);
          const targetNode = nodes.find((n) => n.id === link.targetId);
          const isFailed = sourceNode?.status === 'FAILED' || targetNode?.status === 'FAILED';
          const isPartitioned = sourceNode?.status === 'PARTITIONED' || targetNode?.status === 'PARTITIONED';
          const isCorrupted = flashingNodes.includes(link.sourceId) || flashingNodes.includes(link.targetId);

          let strokeColor = 'rgba(34, 211, 238, 0.35)'; // Cyan default mesh
          if (isCorrupted) strokeColor = '#ef4444';
          else if (isFailed) strokeColor = 'rgba(239, 68, 68, 0.2)';
          else if (isPartitioned) strokeColor = 'rgba(167, 139, 250, 0.4)';

          return (
            <motion.line
              key={`link-${link.sourceId}-${link.targetId}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke={strokeColor}
              strokeWidth={isCorrupted ? 2.5 : isFailed ? 1 : isPartitioned ? 1.5 : 1.2}
              strokeDasharray={isFailed ? '4 4' : isPartitioned ? '3 3' : 'none'}
              strokeOpacity={isCorrupted ? 0.9 : isFailed ? 0.25 : 0.6}
            />
          );
        })}

        {/* Traveling Particles */}
        <AnimatePresence>
          {activeParticles.map((particle) => (
            <motion.circle
              key={particle.id}
              r={particle.size || 5}
              fill={particle.color || '#22d3ee'}
              filter="url(#glow-cyan)"
              initial={{ cx: particle.startX, cy: particle.startY, opacity: 0.9 }}
              animate={{ cx: particle.targetX, cy: particle.targetY, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: particle.duration || 1.2, ease: 'easeInOut' }}
            />
          ))}
        </AnimatePresence>

        {/* Storage Node Groups */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id] || { x: centerX, y: centerY };
          const isFlashing = flashingNodes.includes(node.id);
          const isRepairing = node.status === 'REPAIRING' || repairAuraNodeId === node.id;
          const isFailed = node.status === 'FAILED';
          const isPartitioned = node.status === 'PARTITIONED';
          const statusColor = getStatusColor(node.status, isFlashing);

          const baseRadius = 38;
          const storageScale = Math.min(14, (node.used_storage || 0) / 100);
          const nodeRadius = baseRadius + storageScale;

          return (
            <g
              key={`node-${node.id}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-grab active:cursor-grabbing transition-transform"
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onTouchStart={(e) => handleMouseDown(node.id, e)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((curr) => (curr === node.id ? null : curr))}
            >
              {/* Outer Animated Pulse Ring */}
              <circle
                r={nodeRadius + 7}
                fill="none"
                stroke={statusColor}
                strokeWidth="1.5"
                opacity={isFailed ? 0.2 : 0.6}
              >
                <animate
                  attributeName="r"
                  values={`${nodeRadius + 5};${nodeRadius + 14};${nodeRadius + 5}`}
                  dur={isRepairing ? '1.2s' : '2.5s'}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={isFailed ? '0.1;0.3;0.1' : '0.6;0.1;0.6'}
                  dur={isRepairing ? '1.2s' : '2.5s'}
                  repeatCount="indefinite"
                />
              </circle>

              {/* Outer Orbiting Ring When Partitioned */}
              {isPartitioned && (
                <circle
                  r={nodeRadius + 12}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="10s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Node Body with Solid Dark Fill and Colored Stroke */}
              <circle
                r={nodeRadius}
                fill="#0c1118"
                stroke={statusColor}
                strokeWidth={isPartitioned ? 2 : 2.5}
                strokeDasharray={isPartitioned ? '5 3' : 'none'}
                filter={isRepairing ? 'url(#glow-amber)' : isFlashing ? 'url(#glow-red)' : undefined}
              />

              {/* Node Name */}
              <text
                textAnchor="middle"
                dy="-6"
                fill={isFailed ? '#64748b' : '#f1f5f9'}
                className="text-xs font-semibold font-mono tracking-wider select-none pointer-events-none"
              >
                {node.node_name}
              </text>

              {/* Used Storage Label */}
              <text
                textAnchor="middle"
                dy="12"
                fill={isFailed ? '#475569' : '#94a3b8'}
                className="text-[10px] font-mono select-none pointer-events-none"
              >
                {formatBytes(node.used_storage || 0)}
              </text>

              {/* Status Pill Badge at bottom of circle */}
              <g transform={`translate(0, ${nodeRadius + 12})`}>
                <rect
                  x="-32"
                  y="-8"
                  width="64"
                  height="16"
                  rx="8"
                  fill="#0c1118"
                  stroke={statusColor}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
                <circle
                  cx="-22"
                  cy="0"
                  r="2.5"
                  fill={statusColor}
                />
                <text
                  textAnchor="middle"
                  x="4"
                  y="3.5"
                  fill={statusColor}
                  className="text-[8.5px] font-mono font-bold uppercase select-none pointer-events-none tracking-wider"
                >
                  {isRepairing ? 'REPAIR' : isPartitioned ? 'PARTITION' : node.status}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Node Hover Tooltip */}
      <AnimatePresence>
        {hoveredNode && hoveredNodePos && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 pointer-events-none glass-panel p-3.5 shadow-2xl min-w-[210px] text-xs space-y-2 border border-cyan-500/30"
            style={{
              left: Math.min(width - 230, Math.max(16, hoveredNodePos.x - 105)),
              top: hoveredNodePos.y > height - 180 ? hoveredNodePos.y - 170 : hoveredNodePos.y + 55,
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <span className="font-mono font-bold text-slate-100 text-sm">
                {hoveredNode.node_name}
              </span>
              <StatusPill status={hoveredNode.status} size="xs" />
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <HardDrive className="w-3 h-3 text-cyan-400" /> Storage
                </span>
                <span className="text-slate-200 font-semibold">{formatBytes(hoveredNode.used_storage || 0)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <Layers className="w-3 h-3 text-violet-400" /> Replicas
                </span>
                <span className="text-cyan-300 font-semibold">{hoveredReplicaCount} shards</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <Cpu className="w-3 h-3 text-emerald-400" /> Mount
                </span>
                <span className="text-slate-300 truncate max-w-[100px]">{hoveredNode.path}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <Clock className="w-3 h-3 text-amber-400" /> Heartbeat
                </span>
                <span className="text-slate-400">{formatTime(hoveredNode.last_heartbeat)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
