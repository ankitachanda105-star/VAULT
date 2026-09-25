import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Wrench, Zap, RefreshCw, Upload, ShieldCheck, Clock } from 'lucide-react';
import { formatTime } from '../utils/formatters';

const EVENT_CONFIG = {
  upload: {
    icon: Upload,
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-950/20',
    label: 'Object Ingested',
  },
  node_failed: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-950/20',
    label: 'Node Outage',
  },
  node_recovered: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/20',
    label: 'Node Restored',
  },
  repair_started: {
    icon: Wrench,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/20',
    label: 'Auto-Repair Started',
  },
  repair_completed: {
    icon: ShieldCheck,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/20',
    label: 'Quorum Restored',
  },
  repair_failed: {
    icon: AlertTriangle,
    color: 'text-rose-500',
    border: 'border-rose-500/40',
    bg: 'bg-rose-950/30',
    label: 'Repair Failed',
  },
  corruption_detected: {
    icon: Zap,
    color: 'text-rose-400',
    border: 'border-rose-500/40',
    bg: 'bg-rose-950/20',
    label: 'Bit Rot Detected',
  },
  corruption_repaired: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/20',
    label: 'Bit Rot Healed',
  },
  node_status_changed: {
    icon: RefreshCw,
    color: 'text-sky-400',
    border: 'border-sky-500/30',
    bg: 'bg-sky-950/20',
    label: 'Status Transition',
  },
};

export function ActivityFeed({ events }) {
  return (
    <div className="flex flex-col h-full bg-[#121820] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-sans">
            Live Cluster Activity
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
          {events.length} events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
            <Clock className="w-6 h-6 mb-2 stroke-1 opacity-60" />
            <span>Listening for cluster events...</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((evt) => {
              const conf = EVENT_CONFIG[evt.event] || {
                icon: RefreshCw,
                color: 'text-slate-400',
                border: 'border-slate-700',
                bg: 'bg-slate-900',
                label: evt.event,
              };
              const Icon = conf.icon;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`p-2.5 rounded-lg border ${conf.border} ${conf.bg} flex items-start gap-2.5 text-xs transition-colors`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${conf.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold font-sans ${conf.color}`}>{conf.label}</span>
                      <span className="text-[10px] font-mono text-slate-400">{formatTime(evt.timestamp)}</span>
                    </div>

                    <p className="text-[11px] text-slate-300 mt-0.5 break-words font-sans">
                      {evt.message || JSON.stringify(evt.data)}
                    </p>

                    {evt.data && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                        {evt.data.node_name && (
                          <span className="px-1.5 py-0.2 bg-slate-900/80 rounded border border-slate-700/60">
                            node: {evt.data.node_name}
                          </span>
                        )}
                        {evt.data.object_id && (
                          <span className="px-1.5 py-0.2 bg-slate-900/80 rounded border border-slate-700/60">
                            obj #{evt.data.object_id}
                          </span>
                        )}
                        {evt.data.live_replicas !== undefined && (
                          <span className="px-1.5 py-0.2 bg-emerald-950/60 text-emerald-400 rounded border border-emerald-700/40">
                            live: {evt.data.live_replicas}/{evt.data.replication_factor}
                          </span>
                        )}
                      </div>
                    )}
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
