

interface ConnectionBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ConnectionBadge({ count, size = 'md', showLabel = false }: ConnectionBadgeProps) {
  const tier = count >= 6 ? 'diamond' : count >= 3 ? 'gold' : 'silver';

  const tierEmoji: Record<string, string> = {
    silver: '◇',
    gold: '◆',
    diamond: '💎',
  };

  return (
    <div
      className={`connection-badge badge-${tier} badge-${size}`}
      title={`${count} intentional connection${count !== 1 ? 's' : ''} — ${tier} tier`}
    >
      <span className="badge-icon">{tierEmoji[tier]}</span>
      <span className="badge-count">{count}</span>
      {showLabel && (
        <span className="badge-label">
          {count === 1 ? 'connection' : 'connections'}
        </span>
      )}
    </div>
  );
}
