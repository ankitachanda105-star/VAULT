import React from 'react';

export function StatusPill({ status, size = 'sm', showDot = true, className = '' }) {
  const norm = (status || '').toUpperCase();
  let color = 'ok';
  let label = norm;

  if (norm === 'ONLINE' || norm === 'HEALTHY' || norm === 'OPTIMAL' || norm === 'LIVE') {
    color = 'ok';
  } else if (norm === 'REPAIRING' || norm === 'REPAIR' || norm === 'DEGRADED') {
    color = 'warn';
  } else if (norm === 'FAILED' || norm === 'OFFLINE' || norm === 'CORRUPTED') {
    color = 'bad';
  } else if (norm === 'PARTITIONED' || norm === 'PARTITION') {
    color = 'accent2';
  } else {
    color = 'muted';
  }

  const styles = {
    ok: 'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/25',
    warn: 'bg-amber-500/[0.12] text-amber-400 border-amber-500/25',
    bad: 'bg-rose-500/[0.12] text-rose-400 border-rose-500/25',
    accent2: 'bg-violet-500/[0.12] text-violet-300 border-violet-500/25',
    muted: 'bg-slate-500/[0.12] text-slate-400 border-slate-500/25',
  };

  const dots = {
    ok: 'bg-emerald-400 pulse-dot-ok',
    warn: 'bg-amber-400 pulse-dot-warn',
    bad: 'bg-rose-400 pulse-dot-bad',
    accent2: 'bg-violet-400 pulse-dot-violet',
    muted: 'bg-slate-400',
  };

  const sizeClasses = size === 'xs' 
    ? 'text-[9px] px-1.5 py-0.5' 
    : 'text-[10px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase tracking-wider select-none ${sizeClasses} ${styles[color]} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[color]}`} />}
      <span>{label}</span>
    </span>
  );
}
