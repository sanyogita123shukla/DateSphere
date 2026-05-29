

interface SkeletonCardProps {
  variant?: 'profile' | 'message' | 'request';
  count?: number;
}

export function SkeletonCard({ variant = 'profile', count = 1 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-${variant}`}>
          {variant === 'profile' && (
            <>
              <div className="skeleton-header">
                <div className="skeleton-line skeleton-line-short" />
                <div className="skeleton-badge" />
              </div>
              <div className="skeleton-line skeleton-line-full" />
              <div className="skeleton-line skeleton-line-full" />
              <div className="skeleton-line skeleton-line-medium" />
              <div className="skeleton-button" />
            </>
          )}
          {variant === 'message' && (
            <div className={`skeleton-message ${i % 2 === 0 ? 'skeleton-message-left' : 'skeleton-message-right'}`}>
              <div className="skeleton-line skeleton-line-medium" />
            </div>
          )}
          {variant === 'request' && (
            <div className="skeleton-request">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-line skeleton-line-full" />
              <div className="skeleton-button skeleton-button-small" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
