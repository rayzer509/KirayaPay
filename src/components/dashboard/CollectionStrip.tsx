import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

interface Props {
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
  isLoading: boolean;
}

export function CollectionStrip({ totalDue, totalCollected, collectionRate, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-28 rounded-xl bg-surface border border-border animate-pulse" />;
  }

  const outstanding = totalDue - totalCollected;

  return (
    <Card className="bg-navy text-white border-navy">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-white/60 text-xs font-medium uppercase tracking-wide mb-0.5">This Month</p>
          <p className="text-2xl font-bold money">{formatCurrency(totalCollected)}</p>
          <p className="text-white/60 text-sm">collected of <span className="money text-white">{formatCurrency(totalDue)}</span> due</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-white/60 text-xs mb-0.5">Outstanding</p>
            <p className="text-lg font-semibold money text-coral">{formatCurrency(outstanding)}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs mb-0.5">Collection rate</p>
            <p className="text-lg font-semibold money">{collectionRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-saffron rounded-full transition-all duration-700"
          style={{ width: `${Math.min(collectionRate, 100)}%` }}
        />
      </div>
    </Card>
  );
}
