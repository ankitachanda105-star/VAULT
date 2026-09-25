import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes } from '../utils/formatters';

export function VaultGraph({ nodes, objects, activeParticles, flashingNodes, repairAuraNodeId }) {
  const width = 800;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 210;

  const nodePositions = useMemo(() => {
    const posMap = {};
    const total = 5;
    for (let i = 0; i < total; i++) {
      const angle = (i * 2 * Math.PI) / total - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      posMap[i + 1] = { x, y, angle };
    }
    return posMap;
  }, [centerX, centerY, radius]);

  const links = useMemo(() => {
    const result = [];
    for (let i = 1; i <= 5; i++) {
      for (let j = i + 1; j <= 5; j++) {
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
    return result;
  }, [nodePositions]);

  const getStatusColor = (status, isFlashing) => {
    if (isFlashing) return '#ef4444'; // Flashing Red
    if (status === 'REPAIRING') return '#f59e0b'; // Amber
    if (status === 'PARTITIONED') return '#c084fc'; // Purple / Violet
    if (status === 'FAILED') return '#475569'; // Desaturated Slate / Grey
    return '#10b981'; // Emerald
  };

  const getStatusGlow = (status, isFlashing) => {
    if (isFlashing) return 'rgba(239, 68, 68, 0.5)';
    if (status === 'REPAIRING') return 'rgba(245, 158, 11, 0.4)';
    if (status === 'PARTITIONED') return 'rgba(192, 132, 252, 0.4)';
    if (status === 'FAILED') return 'rgba(71, 85, 105, 0.1)';
    return 'rgba(16, 185, 129, 0.25)';
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0a0e14] overflow-hidden select-none">
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-w-[850px] max-h-[650px] z-10">
        <defs>
          <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Central Core Ingestion Hub */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          <circle r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
          <circle r="6" fill="#38bdf8" opacity="0.8">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
          <text textAnchor="middle" dy="36" fill="#64748b" className="text-[10px] font-mono tracking-widest uppercase">
            Ingest Core
          </text>
        </g>

        {/* Ingestion Hub Spoke Lines */}
        {Object.entries(nodePositions).map(([id, pos]) => (
          <line
            key={`spoke-${id}`}
            x1={centerX}
            y1={centerY}
            x2={pos.x}
            y2={pos.y}
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
          />
        ))}

        {/* Intersite Mesh Topology Lines */}
        {links.map((link) => {
          const sourceNode = nodes.find((n) => n.id === link.sourceId);
          const targetNode = nodes.find((n) => n.id === link.targetId);
          const isFailed = sourceNode?.status === 'FAILED' || targetNode?.status === 'FAILED';
          const isPartitioned = sourceNode?.status === 'PARTITIONED' || targetNode?.status === 'PARTITIONED';
          const isCorrupted = flashingNodes.includes(link.sourceId) || flashingNodes.includes(link.targetId);

          let strokeColor = '#10b981';
          if (isCorrupted) strokeColor = '#ef4444';
          else if (isFailed) strokeColor = '#334155';
          else if (isPartitioned) strokeColor = '#a855f7';

          return (
            <motion.line
              key={`link-${link.sourceId}-${link.targetId}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke={strokeColor}
              strokeWidth={isCorrupted ? 2.5 : isFailed ? 1 : isPartitioned ? 1.5 : 1.5}
              strokeDasharray={isFailed ? '4 4' : isPartitioned ? '3 3' : 'none'}
              strokeOpacity={isCorrupted ? 0.9 : isFailed ? 0.25 : isPartitioned ? 0.6 : 0.4}
              animate={{
                strokeOpacity: isCorrupted ? [0.2, 1, 0.4] : undefined,
              }}
              transition={{ duration: 0.5, repeat: isCorrupted ? 3 : 0 }}
            />
          );
        })}

        {/* Traveling Particles */}
        <AnimatePresence>
          {activeParticles.map((particle) => (
            <motion.circle
              key={particle.id}
              r={particle.size || 5}
              fill={particle.color || '#38bdf8'}
              filter="url(#glow-amber)"
              initial={{ cx: particle.startX, cy: particle.startY, opacity: 0.9 }}
              animate={{ cx: particle.targetX, cy: particle.targetY, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: particle.duration || 1.2, ease: 'easeInOut' }}
            />
          ))}
        </AnimatePresence>

        {/* Storage Node Circles */}
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
            <g key={`node-${node.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
              {/* Outer Pulsing Aura When Repairing */}
              {isRepairing && (
                <motion.circle
                  r={nodeRadius + 14}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  animate={{ r: [nodeRadius + 6, nodeRadius + 22, nodeRadius + 6], opacity: [0.8, 0.2, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Outer Orbiting Ring When Partitioned */}
              {isPartitioned && (
                <motion.circle
                  r={nodeRadius + 10}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Status Halo */}
              <circle
                r={nodeRadius + 4}
                fill="none"
                stroke={statusColor}
                strokeWidth="1.5"
                opacity={isFailed ? 0.3 : 0.8}
                filter={
                  isRepairing
                    ? 'url(#glow-amber)'
                    : isFlashing
                    ? 'url(#glow-red)'
                    : isPartitioned
                    ? 'url(#glow-purple)'
                    : 'url(#glow-emerald)'
                }
              />

              {/* Main Node Circle */}
              <motion.circle
                r={nodeRadius}
                fill={isFailed ? '#1e293b' : isPartitioned ? '#1e1b4b' : '#0f172a'}
                stroke={statusColor}
                strokeWidth={isPartitioned ? 2 : 2.5}
                strokeDasharray={isPartitioned ? '6 3' : 'none'}
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />

              {/* Node Title */}
              <text
                textAnchor="middle"
                dy="-6"
                fill={isFailed ? '#64748b' : '#f8fafc'}
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

              {/* Status Badge */}
              <rect
                x="-32"
                y={nodeRadius + 8}
                width="64"
                height="16"
                rx="4"
                fill="#0f172a"
                stroke={statusColor}
                strokeWidth="1"
              />
              <text
                textAnchor="middle"
                x="0"
                y={nodeRadius + 20}
                fill={statusColor}
                className="text-[9px] font-mono font-bold uppercase select-none pointer-events-none tracking-wider"
              >
                {isRepairing ? 'REPAIR' : isPartitioned ? 'PARTITION' : node.status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
