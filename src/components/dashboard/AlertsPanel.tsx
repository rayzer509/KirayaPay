import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertTriangle, Zap, Wrench, FileText } from 'lucide-react';

interface Props {
  pendingReadings: number;
  openMaintenance: number;
  expiringLeases: number;
}

export function AlertsPanel({ pendingReadings, openMaintenance, expiringLeases }: Props) {
  const alerts = [
    pendingReadings > 0 && {
      icon: Zap,
      color: 'text-saffron bg-saffron-light',
      message: `${pendingReadings} billing cycle${pendingReadings > 1 ? 's' : ''} awaiting meter readings`,
      href: '/dashboard/billing',
    },
    openMaintenance > 0 && {
      icon: Wrench,
      color: 'text-coral bg-coral-light',
      message: `${openMaintenance} open maintenance request${openMaintenance > 1 ? 's' : ''}`,
      href: '/dashboard/maintenance',
    },
    expiringLeases > 0 && {
      icon: FileText,
      color: 'text-saffron bg-saffron-light',
      message: `${expiringLeases} lease${expiringLeases > 1 ? 's' : ''} expiring within 60 days`,
      href: '/dashboard/leases',
    },
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        {alerts.length > 0 && (
          <div className="w-5 h-5 rounded-full bg-coral-light flex items-center justify-center">
            <span className="text-coral text-xs font-bold">{alerts.length}</span>
          </div>
        )}
      </CardHeader>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 py-4">
          <div className="w-8 h-8 rounded-lg bg-sage-light flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-sage" />
          </div>
          <p className="text-sm text-slate">All clear — no pending actions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => alert && (
            <Link key={i} href={alert.href} className="flex items-start gap-3 p-3 rounded-lg hover:bg-bg transition group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alert.color}`}>
                <alert.icon className="w-4 h-4" />
              </div>
              <p className="text-sm text-navy group-hover:text-saffron transition">{alert.message}</p>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
