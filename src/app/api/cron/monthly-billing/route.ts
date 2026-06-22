import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, addMonths } from 'date-fns';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cycleMonth = startOfMonth(now);
  // Landlord has until the 15th to enter readings
  const readingsDueBy = new Date(now.getFullYear(), now.getMonth(), 15);

  // --- Rent escalation check ---
  const leasesForEscalation = await prisma.lease.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      next_escalation_date: { lte: now },
      escalation_rate: { not: null },
    },
  });

  for (const lease of leasesForEscalation) {
    if (!lease.escalation_rate) continue;
    const currentRent = Number(lease.monthly_rent);
    const rate = Number(lease.escalation_rate);
    const newRent = Math.round(currentRent * (1 + rate / 100));

    await prisma.leaseAmendment.create({
      data: {
        lease_id: lease.id,
        field_changed: 'monthly_rent',
        old_value: String(currentRent),
        new_value: String(newRent),
        effective_from: now,
        amended_by: lease.tenant_id, // system-generated; tenant_id used as placeholder
        note: `Auto-escalation: ${rate}% annual increase`,
      },
    });

    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        monthly_rent: newRent,
        next_escalation_date: addMonths(lease.next_escalation_date!, 12),
      },
    });
  }
  // --- End escalation check ---

  const activeLeases = await prisma.lease.findMany({
    where: { status: 'active', deleted_at: null },
    include: { unit: true },
  });

  if (activeLeases.length === 0) {
    return NextResponse.json({ message: 'No active leases', cyclesCreated: 0, billsCreated: 0 });
  }

  // Group leases by property
  const byProperty = new Map<string, typeof activeLeases>();
  for (const lease of activeLeases) {
    const list = byProperty.get(lease.unit.property_id) ?? [];
    list.push(lease);
    byProperty.set(lease.unit.property_id, list);
  }

  let cyclesCreated = 0;
  let billsCreated = 0;

  for (const [propertyId, leases] of Array.from(byProperty)) {
    let cycle = await prisma.billingCycle.findFirst({
      where: { property_id: propertyId, cycle_month: cycleMonth },
    });

    if (!cycle) {
      cycle = await prisma.billingCycle.create({
        data: {
          property_id: propertyId,
          cycle_month: cycleMonth,
          readings_due_by: readingsDueBy,
          status: 'open',
        },
      });
      cyclesCreated++;
    }

    for (const lease of leases) {
      // Skip if billing hasn't started yet for pre-existing tenants
      const billingStart = lease.billing_start_date ?? lease.start_date;
      if (billingStart > cycleMonth) continue;

      const existing = await prisma.bill.findFirst({
        where: { cycle_id: cycle.id, lease_id: lease.id },
      });
      if (existing) continue;

      const rent = Number(lease.monthly_rent);
      const dueDate = new Date(now.getFullYear(), now.getMonth(), lease.rent_due_day);

      await prisma.bill.create({
        data: {
          cycle_id: cycle.id,
          unit_id: lease.unit_id,
          lease_id: lease.id,
          total_amount: rent,
          due_date: dueDate,
          status: 'sent',
          // generated_at left null — utilities will be added when landlord enters readings
          line_items: {
            create: [
              {
                type: 'rent',
                description: 'Monthly Rent',
                quantity: 1,
                rate_snapshot: rent,
                amount: rent,
                sort_order: 1,
              },
            ],
          },
        },
      });
      billsCreated++;
    }
  }

  return NextResponse.json({
    message: 'Monthly billing complete',
    month: cycleMonth.toISOString().slice(0, 7),
    cyclesCreated,
    billsCreated,
  });
}
