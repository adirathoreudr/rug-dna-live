// ============================================================
// RUG DNA — Utility Functions
// ============================================================

// Lightweight nanoid replacement (no native deps)
export function nanoid(size = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(size);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (const byte of bytes) result += chars[byte % chars.length];
  return result;
}

// Tailwind class merger
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Format USD
export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// Truncate address
export function truncAddr(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

// Format timestamp
export function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

// Relative time
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Risk level color classes
export function riskColor(level: string): string {
  switch (level) {
    case 'critical': return '#ff3b3b';
    case 'high': return '#ff7a00';
    case 'moderate': return '#ffb300';
    case 'low': return '#00ff88';
    default: return '#888';
  }
}

export function riskBgColor(level: string): string {
  switch (level) {
    case 'critical': return 'rgba(255,59,59,0.12)';
    case 'high': return 'rgba(255,122,0,0.12)';
    case 'moderate': return 'rgba(255,179,0,0.12)';
    case 'low': return 'rgba(0,255,136,0.1)';
    default: return 'rgba(255,255,255,0.05)';
  }
}
