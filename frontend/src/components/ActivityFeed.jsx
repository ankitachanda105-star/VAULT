import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Zap,
  RefreshCw,
  UploadCloud,
  ShieldCheck,
  Clock,
  Trash2,
  Layers,
  Scale
} from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { StatusPill } from './StatusPill';

const EVENT_CONFIG = {
  upload: {
    icon: UploadCloud,
    color: 'text-cyan-400',
    border: 'border-cyan-500/25',
    bg: 'bg-cyan-500/[0.06]',
    badge: 'INGEST',
    status: 'OPTIMAL',
  },
  object_uploaded: {
    icon: UploadCloud,
    color: 'text-cyan-400',
    border: 'border-cyan-500/25',
    bg: 'bg-cyan-500/[0.06]',
    badge: 'INGEST',
    status: 'OPTIMAL',
  },
  object_updated: {
    icon: Layers,
    color: 'text-violet-400',
    border: 'border-violet-500/25',
    bg: 'bg-violet-500/[0.06]',
    badge: 'VERSION',
    status: 'OPTIMAL',
  },
  node_failed: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    border: 'border-rose-500/25',
    bg: 'bg-rose-500/[0.06]',
    badge: 'OUTAGE',
    status: 'FAILED',
  },
  node_partitioned: {
    icon: AlertTriangle,
    color: 'text-violet-400',
    border: 'border-violet-500/25',
    bg: 'bg-violet-500/[0.06]',
    badge: 'PARTITION',
    status: 'PARTITION',
  },
  node_recovered: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/[0.06]',
    badge: 'ONLINE',
    status: 'HEALTHY',
  },
  repair_started: {
    icon: Wrench,
    color: 'text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/[0.06]',
    badge: 'HEALING',
    status: 'REPAIRING',
  },
  repair_completed: {
    icon: ShieldCheck,
    color: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/[0.06]',
    badge: 'QUORUM',
    status: 'HEALTHY',
  },
  repair_failed: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/[0.08]',
    badge: 'FAILED',
    status: 'FAILED',
  },
  corruption_detected: {
    icon: Zap,
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/[0.08]',
    badge: 'BIT ROT',
    status: 'FAILED',
  },
  corruption_repaired: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/[0.06]',
    badge: 'RESTORED',
    status: 'HEALTHY',
  },
  rebalance_completed: {
    icon: Scale,
    color: 'text-cyan-400',
    border: 'border-cyan-500/25',
    bg: 'bg-cyan-500/[0.06]',
    badge: 'REBALANCE',
    status: 'OPTIMAL',
  },
  node_status_changed: {
    icon: RefreshCw,
    color: 'text-cyan-300',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/[0.05]',
    badge: 'STATE',
    status: 'ONLINE',
  },
};

export function formatEventLine(evt) {
  const d = evt.data || {};
  const event = evt.event;

  switch (event) {
    case 'node_failed': {
      const name = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Node');
      return `${name} went offline`;
    }
    case 'node_recovered': {
      const name = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Node');
      return `${name} back online`;
    }
    case 'node_partitioned': {
      const name = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Node');
      return `${name} isolated (network partition)`;
    }
    case 'repair_started': {
      const target = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'cluster node');
      const obj = d.object_name || (d.object_id ? `object #${d.object_id}` : 'object');
      return `Repairing ${obj} → ${target}`;
    }
    case 'repair_completed': {
      const target = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Target node');
      const live = d.live_replicas ?? d.healthy_replicas ?? 3;
      const rf = d.replication_factor ?? 3;
      return `${target} restored — ${live}/${rf} replicas healthy`;
    }
    case 'repair_failed': {
      const obj = d.object_name || (d.object_id ? `object #${d.object_id}` : 'object');
      return `Repair failed for ${obj}`;
    }
    case 'corruption_detected': {
      const target = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'node');
      const obj = d.object_name || (d.object_id ? `object #${d.object_id}` : 'object');
      return `Corruption detected on ${target} (${obj})`;
    }
    case 'corruption_repaired': {
      const target = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Node');
      return `${target} replica repaired and verified`;
    }
    case 'rebalance_completed': {
      const moved = d.objects_moved || [];
      if (moved.length === 0) return 'Storage rebalance completed — cluster balanced';
      const summary = moved.map((m) => `Node-${m.from_node_id} → Node-${m.to_node_id}`).join(', ');
      return `Rebalanced ${moved.length} object(s): ${summary}`;
    }
    case 'object_updated': {
      const obj = d.object_name || (d.object_id ? `object #${d.object_id}` : 'Object');
      const v = d.version ? `v${d.version}` : 'new version';
      return `Upgraded ${obj} to ${v} across replicas`;
    }
    case 'upload':
    case 'object_uploaded': {
      const obj = d.object_name || d.name || (d.object_id ? `object #${d.object_id}` : 'Object');
      const reps = Array.isArray(d.replicas) ? ` [${d.replicas.join(', ')}]` : '';
      return `Uploaded '${obj}'${reps}`;
    }
    case 'node_status_changed': {
      const name = d.node_name || (d.node_id ? `Node-${d.node_id}` : 'Node');
      return `${name} status changed to ${d.status || 'unknown'}`;
    }
    default:
      if (evt.message && typeof evt.message === 'string') return evt.message;
      return `${event.replace(/_/g, ' ')}`;
  }
}

export function ActivityFeed({ events, onClear }) {
  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden shadow-xl">
      {/* Header with Clear Button */}
      <div className="p-3 border-b border-[var(--line)] flex items-center justify-between bg-[#0c1118]/60">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Live Cluster Activity
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-full border border-[var(--line)]">
            {events.length} events
          </span>
          {events.length > 0 && onClear && (
            <button
              onClick={onClear}
              title="Clear visible feed"
              className="text-[10px] font-mono text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-500/10"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
            <Clock className="w-6 h-6 mb-2 stroke-1 opacity-50 text-cyan-400" />
            <span className="font-sans">Listening for cluster WebSocket events...</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((evt) => {
              const conf = EVENT_CONFIG[evt.event] || {
                icon: RefreshCw,
                color: 'text-slate-400',
                border: 'border-slate-800',
                bg: 'bg-slate-900/40',
                badge: 'EVENT',
                status: 'ONLINE',
              };
              const Icon = conf.icon;
              const lineText = formatEventLine(evt);

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={`p-2.5 rounded-xl border ${conf.border} ${conf.bg} flex items-center gap-2.5 text-xs transition-colors`}
                >
                  <div className={`p-1.5 rounded-lg bg-[#0c1118]/80 border border-[var(--line)] shrink-0 ${conf.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <StatusPill status={conf.status} size="xs" showDot={true} />
                      <span className="text-[11px] font-sans text-slate-200 font-medium truncate">
                        {lineText}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                      {formatTime(evt.timestamp)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
