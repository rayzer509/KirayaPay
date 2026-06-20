import { Card } from '@/components/ui/Card';
import { Building2, Zap, Wrench, FileText } from 'lucide-react';

interface Props {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  pendingReadings: number;
  openMaintenance: number;
  expiringLeases: number;
  isLoading: boolean;
}

export function StatsCards({ totalUnits, occupiedUnits, vacantUnits, pendingReadings, openMaintenance, expiringLeases, isLoading }: Props) {
  const stats = [
    {
      label: 'Units',
      value: `${occupiedUnits}/${totalUnits}`,
      sub: `${vacantUnits} vacant`,
      icon: Building2,
      color: 'text-sage bg-sage-light',
    },
    {
      label: 'Pending Readings',
      value: pendingReadings,
      sub: 'billing cycles open',
      icon: Zap,
      color: pendingReadings > 0 ? 'text-saffron bg-saffron-light' : 'text-sage bg-sage-light',
    },
    {
      label: 'Open Maintenance',
      value: openMaintenance,
      sub: 'requests active',
      icon: Wrench,
      color: openMaintenance > 0 ? 'text-coral bg-coral-light' : 'text-sage bg-sage-light',
    },
    {
      label: 'Lease Renewals',
      value: expiringLeases,
      sub: 'due in 60 days',
      icon: FileText,
      color: expiringLeases > 0 ? 'text-saffron bg-saffron-light' : 'text-sage bg-sage-light',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} padding="sm">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy money">{s.value}</p>
              <p className="text-xs text-slate">{s.label}</p>
              <p className="text-xs text-slate/70">{s.sub}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
