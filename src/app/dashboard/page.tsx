'use client';

import { Topbar } from '@/components/layout/Topbar';
import { trpc } from '@/lib/trpc';
import { CollectionStrip } from '@/components/dashboard/CollectionStrip';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { UnitsTable } from '@/components/dashboard/UnitsTable';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';

export default function DashboardPage() {
  const { data: summary, isLoading } = trpc.dashboard.summary.useQuery();
  const { data: units } = trpc.dashboard.unitsWithStatus.useQuery();

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Dashboard" />
      <main className="flex-1 p-6 space-y-6">
        <CollectionStrip
          totalDue={summary?.totalDue ?? 0}
          totalCollected={summary?.totalCollected ?? 0}
          collectionRate={summary?.collectionRate ?? 0}
          isLoading={isLoading}
        />

        <StatsCards
          totalUnits={summary?.totalUnits ?? 0}
          occupiedUnits={summary?.occupiedUnits ?? 0}
          vacantUnits={summary?.vacantUnits ?? 0}
          pendingReadings={summary?.pendingReadings ?? 0}
          openMaintenance={summary?.openMaintenance ?? 0}
          expiringLeases={summary?.expiringLeases ?? 0}
          isLoading={isLoading}
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <UnitsTable units={units ?? []} />
          </div>
          <div>
            <AlertsPanel
              pendingReadings={summary?.pendingReadings ?? 0}
              openMaintenance={summary?.openMaintenance ?? 0}
              expiringLeases={summary?.expiringLeases ?? 0}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
