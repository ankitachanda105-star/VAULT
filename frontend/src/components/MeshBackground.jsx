import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function MeshBackground({ opacity = 0.35, className = '' }) {
  const width = 1000;
  const height = 700;

  // Generate 18 evenly distributed, non-overlapping nodes across a grid
  const { nodes, links } = useMemo(() => {
    const cols = 5;
    const rows = 4;
    const cellW = width / cols;
    const cellH = height / rows;
    const padding = 38;

    const generatedNodes = [];
    let idCounter = 1;

    // Pick 18 of the 20 cells
    const cellIndices = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Skip 2 corner cells to leave exactly 18 nodes
        if ((r === 0 && c === 0) || (r === rows - 1 && c === cols - 1)) continue;
        cellIndices.push({ r, c });
      }
    }

    cellIndices.forEach((cell, idx) => {
      const minX = cell.c * cellW + padding;
      const maxX = (cell.c + 1) * cellW - padding;
      const minY = cell.r * cellH + padding;
      const maxY = (cell.r + 1) * cellH - padding;

      // Deterministic natural jitter
      const pseudoRand1 = ((idx * 37 + 13) % 100) / 100;
      const pseudoRand2 = ((idx * 59 + 29) % 100) / 100;

      const x = minX + pseudoRand1 * (maxX - minX);
      const y = minY + pseudoRand2 * (maxY - minY);

      // Color distribution: emerald green (majority), 3 amber, 2 muted grey
      let type = 'emerald';
      let color = '#10b981';
      let radius = 3.5;

      if (idx === 4 || idx === 11 || idx === 15) {
        type = 'amber';
        color = '#f59e0b';
        radius = 3.5;
      } else if (idx === 7 || idx === 13) {
        type = 'grey';
        color = '#64748b';
        radius = 2.8;
      }

      generatedNodes.push({
        id: idCounter++,
        x,
        y,
        type,
        color,
        radius,
        pulseDur: 3.2 + (idx % 4) * 0.7,
        pulseDelay: (idx % 5) * 0.5,
      });
    });

    // Compute 3 nearest neighbors for each node by Euclidean distance
    const linkSet = new Set();
    const computedLinks = [];

    generatedNodes.forEach((node) => {
      const distances = generatedNodes
        .filter((other) => other.id !== node.id)
        .map((other) => {
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return { other, dist };
        })
        .sort((a, b) => a.dist - b.dist);

      const neighbors = distances.slice(0, 3);
      neighbors.forEach(({ other }) => {
        const key = node.id < other.id ? `${node.id}-${other.id}` : `${other.id}-${node.id}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          computedLinks.push({
            id: key,
            source: node,
            target: other,
            x1: node.x,
            y1: node.y,
            x2: other.x,
            y2: other.y,
          });
        }
      });
    });

    return { nodes: generatedNodes, links: computedLinks };
  }, []);

  // Occasional traveling particle along a random connection line
  const [activeParticle, setActiveParticle] = useState(null);

  useEffect(() => {
    if (links.length === 0) return;

    let timeoutId = null;

    const launchRandomParticle = () => {
      const randomLink = links[Math.floor(Math.random() * links.length)];
      if (randomLink) {
        setActiveParticle({
          id: Date.now(),
          startX: randomLink.x1,
          startY: randomLink.y1,
          targetX: randomLink.x2,
          targetY: randomLink.y2,
          color: randomLink.source.type === 'amber' ? '#f59e0b' : '#22d3ee',
        });
      }

      // Schedule next particle in 4 to 8 seconds
      const nextDelay = 4000 + Math.random() * 4000;
      timeoutId = setTimeout(launchRandomParticle, nextDelay);
    };

    timeoutId = setTimeout(launchRandomParticle, 2000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [links]);

  return (
    <div
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
      style={{ opacity }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          <filter id="mesh-glow-emerald" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="mesh-glow-amber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="mesh-glow-particle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Gradients for links: brighter near endpoints, fainter mid-line */}
          {links.map((link) => (
            <linearGradient
              key={`grad-${link.id}`}
              id={`grad-${link.id}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={link.source.color} stopOpacity="0.45" />
              <stop offset="50%" stopColor="rgba(148, 163, 184, 0.08)" stopOpacity="0.08" />
              <stop offset="100%" stopColor={link.target.color} stopOpacity="0.45" />
            </linearGradient>
          ))}
        </defs>

        {/* Mesh Connection Lines */}
        {links.map((link) => (
          <line
            key={`mesh-link-${link.id}`}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke={`url(#grad-${link.id})`}
            strokeWidth="0.9"
          />
        ))}

        {/* Occasional traveling ambient particle */}
        <AnimatePresence>
          {activeParticle && (
            <motion.circle
              key={activeParticle.id}
              r={2.5}
              fill={activeParticle.color}
              filter="url(#mesh-glow-particle)"
              initial={{ cx: activeParticle.startX, cy: activeParticle.startY, opacity: 0 }}
              animate={{
                cx: activeParticle.targetX,
                cy: activeParticle.targetY,
                opacity: [0, 0.85, 0.85, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        {/* Mesh Nodes */}
        {nodes.map((node) => {
          const filterId =
            node.type === 'amber'
              ? 'url(#mesh-glow-amber)'
              : node.type === 'emerald'
              ? 'url(#mesh-glow-emerald)'
              : undefined;

          return (
            <g key={`mesh-node-${node.id}`} transform={`translate(${node.x}, ${node.y})`}>
              {/* Outer Pulsing Glow Circle */}
              {node.type !== 'grey' && (
                <circle
                  r={node.radius + 4}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="0.8"
                  opacity="0.3"
                >
                  <animate
                    attributeName="r"
                    values={`${node.radius + 2};${node.radius + 6};${node.radius + 2}`}
                    dur={`${node.pulseDur}s`}
                    begin={`${node.pulseDelay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.15;0.45;0.15"
                    dur={`${node.pulseDur}s`}
                    begin={`${node.pulseDelay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Node Center */}
              <circle
                r={node.radius}
                fill={node.color}
                filter={filterId}
                opacity={node.type === 'grey' ? 0.45 : 0.85}
              >
                <animate
                  attributeName="opacity"
                  values={node.type === 'grey' ? '0.3;0.5;0.3' : '0.6;0.95;0.6'}
                  dur={`${node.pulseDur}s`}
                  begin={`${node.pulseDelay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
