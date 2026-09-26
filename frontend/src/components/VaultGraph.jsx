import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes, formatTime } from '../utils/formatters';
import { StatusPill } from './StatusPill';
import { Radio, HardDrive, Cpu, Clock, Layers } from 'lucide-react';

export function VaultGraph({ nodes, objects, activeParticles, flashingNodes, repairAuraNodeId }) {
  const width = 800;
  const height = 580;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;
  const svgRef = useRef(null);

  // Staggered pulse timing configurations for the 5 real nodes
  const pulseConfigs = [
    { dur: 3.4, delay: 0.0 },
    { dur: 4.1, delay: 0.8 },
    { dur: 4.7, delay: 1.6 },
    { dur: 3.7, delay: 2.4 },
    { dur: 4.3, delay: 3.2 },
  ];

  // Stable organic circle positions for the 5 real nodes
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

  // Base Full Mesh: all 10 possible interconnect lines between the 5 nodes
  const allMeshLinks = useMemo(() => {
    const result = [];
    for (let i = 1; i <= 5; i++) {
      for (let j = i + 1; j <= 5; j++) {
        if (nodePositions[i] && nodePositions[j]) {
          result.push({
            id: `${i}-${j}`,
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

  // Real Replica-Sharing Connections: determined from live objects state
  const activeReplicaPairs = useMemo(() => {
    const active = new Set();

    // 1. Check if any objects have replicas list
    objects.forEach((obj) => {
      if (Array.isArray(obj.replicas) && obj.replicas.length > 1) {
        const ids = obj.replicas
          .map((r) => {
            if (typeof r === 'number') return r;
            const match = String(r).match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
          })
          .filter(Boolean);

        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const minId = Math.min(ids[i], ids[j]);
            const maxId = Math.max(ids[i], ids[j]);
            active.add(`${minId}-${maxId}`);
          }
        }
      }
    });

    // 2. If existing objects don't specify explicit replica array, connect nodes with used_storage > 0
    if (active.size === 0 && objects.length > 0) {
      const storedNodes = nodes.filter((n) => (n.used_storage || 0) > 0).map((n) => n.id);
      if (storedNodes.length >= 2) {
        for (let i = 0; i < storedNodes.length; i++) {
          for (let j = i + 1; j < storedNodes.length; j++) {
            const minId = Math.min(storedNodes[i], storedNodes[j]);
            const maxId = Math.max(storedNodes[i], storedNodes[j]);
            active.add(`${minId}-${maxId}`);
          }
        }
      } else {
        // Fallback quorum (first 3 online nodes)
        const onlineIds = nodes.filter((n) => n.status === 'ONLINE').map((n) => n.id).slice(0, 3);
        for (let i = 0; i < onlineIds.length; i++) {
          for (let j = i + 1; j < onlineIds.length; j++) {
            active.add(`${Math.min(onlineIds[i], onlineIds[j])}-${Math.max(onlineIds[i], onlineIds[j])}`);
          }
        }
      }
    }

    return active;
  }, [objects, nodes]);

  const getStatusColor = (status, isFlashing) => {
    if (isFlashing) return '#ef4444'; // Red
    if (status === 'REPAIRING') return '#f59e0b'; // Amber
    if (status === 'PARTITIONED') return '#a78bfa'; // Violet
    if (status === 'FAILED') return '#64748b'; // Muted Grey
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
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none bg-[#0a0e14]"
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
            Topology Mesh (5 Real Nodes)
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            — Base mesh + Real replica quorum
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-1 rounded-full glass-panel-sub text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot-ok" />
            <span className="text-slate-300">ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 pulse-dot-warn" />
            <span className="text-slate-300">REPAIRING</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 pulse-dot-violet" />
            <span className="text-slate-300">PARTITIONED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">FAILED</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full max-w-[850px] max-h-[600px] z-10"
      >
        <defs>
          <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-emerald-line" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-particle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Central Ingest Core Hub */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          <circle r="24" fill="#0c1118" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1.2" opacity="0.75" />
          <circle r="5" fill="#22d3ee" opacity="0.8">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
          <text textAnchor="middle" dy="36" fill="#64748b" className="text-[9px] font-mono tracking-widest uppercase select-none">
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
            stroke="rgba(148, 163, 184, 0.10)"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
        ))}

        {/* LAYER 1: BASE FULL MESH (All 10 interconnect lines, faint and static) */}
        {allMeshLinks.map((link) => {
          const sourceNode = nodes.find((n) => n.id === link.sourceId);
          const targetNode = nodes.find((n) => n.id === link.targetId);
          const isFailed = sourceNode?.status === 'FAILED' || targetNode?.status === 'FAILED';

          return (
            <line
              key={`base-mesh-${link.id}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke={isFailed ? 'rgba(71, 85, 105, 0.10)' : 'rgba(148, 163, 184, 0.14)'}
              strokeWidth={isFailed ? 0.8 : 1}
              strokeDasharray={isFailed ? '3 3' : 'none'}
            />
          );
        })}

        {/* LAYER 2: BRIGHT REAL REPLICA CONNECTIONS (Drawn on top of base mesh) */}
        {allMeshLinks.map((link) => {
          const isReplicaPair = activeReplicaPairs.has(link.id);
          if (!isReplicaPair) return null; // Only render real replica relationships here

          const sourceNode = nodes.find((n) => n.id === link.sourceId);
          const targetNode = nodes.find((n) => n.id === link.targetId);
          const isFailed = sourceNode?.status === 'FAILED' || targetNode?.status === 'FAILED';
          const isPartitioned = sourceNode?.status === 'PARTITIONED' || targetNode?.status === 'PARTITIONED';
          const isCorrupted = flashingNodes.includes(link.sourceId) || flashingNodes.includes(link.targetId);
          const isRepairing =
            sourceNode?.status === 'REPAIRING' ||
            targetNode?.status === 'REPAIRING' ||
            repairAuraNodeId === link.sourceId ||
            repairAuraNodeId === link.targetId;

          let strokeColor = '#10b981'; // Emerald glow for healthy active replica links
          let strokeWidth = 2.4;
          let strokeDasharray = 'none';
          let strokeOpacity = 0.85;

          if (isCorrupted) {
            strokeColor = '#ef4444';
            strokeWidth = 3.2;
            strokeOpacity = 1;
          } else if (isFailed) {
            strokeColor = 'rgba(239, 68, 68, 0.4)';
            strokeWidth = 1.2;
            strokeDasharray = '4 4';
            strokeOpacity = 0.45;
          } else if (isPartitioned) {
            strokeColor = '#a78bfa';
            strokeWidth = 2;
            strokeDasharray = '5 3';
            strokeOpacity = 0.7;
          } else if (isRepairing) {
            strokeColor = '#f59e0b';
            strokeWidth = 2.6;
            strokeOpacity = 0.95;
          }

          return (
            <motion.line
              key={`replica-line-${link.id}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeOpacity={strokeOpacity}
              filter={isRepairing ? 'url(#glow-amber)' : isCorrupted ? 'url(#glow-red)' : 'url(#glow-emerald-line)'}
              animate={{
                strokeOpacity: isCorrupted ? [0.3, 1, 0.3] : undefined,
              }}
              transition={{ duration: 0.5, repeat: isCorrupted ? 4 : 0 }}
            />
          );
        })}

        {/* Traveling Particles (Upload / Repair / Rebalance) */}
        <AnimatePresence>
          {activeParticles.map((particle) => (
            <motion.circle
              key={particle.id}
              r={particle.size || 5}
              fill={particle.color || '#22d3ee'}
              filter="url(#glow-particle)"
              initial={{ cx: particle.startX, cy: particle.startY, opacity: 0.9 }}
              animate={{ cx: particle.targetX, cy: particle.targetY, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: particle.duration || 1.2, ease: 'easeInOut' }}
            />
          ))}
        </AnimatePresence>

        {/* THE 5 REAL STORAGE NODES */}
        {nodes.map((node, idx) => {
          const pos = nodePositions[node.id] || { x: centerX, y: centerY };
          const isFlashing = flashingNodes.includes(node.id);
          const isRepairing = node.status === 'REPAIRING' || repairAuraNodeId === node.id;
          const isFailed = node.status === 'FAILED';
          const isPartitioned = node.status === 'PARTITIONED';
          const isOnline = node.status === 'ONLINE' && !isFlashing && !isRepairing;
          const statusColor = getStatusColor(node.status, isFlashing);

          // Node size reflects used_storage
          const baseRadius = 36;
          const storageScale = Math.min(14, (node.used_storage || 0) / 100);
          const nodeRadius = baseRadius + storageScale;

          // Staggered ambient pulse configuration
          const pulse = pulseConfigs[(node.id - 1) % 5] || { dur: 3.5, delay: 0 };

          return (
            <g
              key={`real-node-${node.id}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-grab active:cursor-grabbing transition-transform"
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onTouchStart={(e) => handleMouseDown(node.id, e)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((curr) => (curr === node.id ? null : curr))}
            >
              {/* Slow, gentle ambient pulse ring for ONLINE nodes at rest (staggered, not synced) */}
              {isOnline && (
                <circle
                  r={nodeRadius + 6}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.2"
                  opacity="0.4"
                >
                  <animate
                    attributeName="r"
                    values={`${nodeRadius + 4};${nodeRadius + 13};${nodeRadius + 4}`}
                    dur={`${pulse.dur}s`}
                    begin={`${pulse.delay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.45;0.08;0.45"
                    dur={`${pulse.dur}s`}
                    begin={`${pulse.delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Repairing pulsing aura */}
              {isRepairing && (
                <circle
                  r={nodeRadius + 10}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  opacity="0.7"
                >
                  <animate
                    attributeName="r"
                    values={`${nodeRadius + 6};${nodeRadius + 20};${nodeRadius + 6}`}
                    dur="1.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.8;0.15;0.8"
                    dur="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Partitioned dashed outline */}
              {isPartitioned && (
                <circle
                  r={nodeRadius + 8}
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
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Node Solid Body with Colored Stroke */}
              <circle
                r={nodeRadius}
                fill={isFailed ? '#1e293b' : '#0c1118'}
                stroke={statusColor}
                strokeWidth={isPartitioned ? 2 : 2.5}
                strokeDasharray={isPartitioned ? '5 3' : 'none'}
                opacity={isFailed ? 0.6 : 1}
                filter={isRepairing ? 'url(#glow-amber)' : isFlashing ? 'url(#glow-red)' : isOnline ? 'url(#glow-emerald)' : undefined}
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
