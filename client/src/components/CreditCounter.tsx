

interface CreditCounterProps {
  credits: number;
  max?: number;
}

export function CreditCounter({ credits, max = 5 }: CreditCounterProps) {
  const percentage = (credits / max) * 100;
  const isLow = credits <= 1;

  return (
    <div className={`credit-counter ${isLow ? 'credit-counter-low' : ''}`}>
      <div className="credit-ring">
        <svg viewBox="0 0 36 36" className="credit-ring-svg">
          <path
            className="credit-ring-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="credit-ring-fill"
            strokeDasharray={`${percentage}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="credit-ring-text">{credits}</span>
      </div>
      <div className="credit-label">
        <span className="credit-label-count">{credits}/{max}</span>
        <span className="credit-label-text">Slots</span>
      </div>
    </div>
  );
}
