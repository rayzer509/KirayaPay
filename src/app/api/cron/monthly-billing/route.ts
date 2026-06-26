import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { endOfMonth, startOfMonth, addMonths } from 'date-fns';
import { ensurePropertyAccounts, ensureTenantArAccount, arAccountCode, ACCOUNTS } from '@/lib/accounts';
import { postJournalEntry, chargeRaisedLines } from '@/lib/journal';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cycleMonth = startOfMonth(now);
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
        lease_id:       lease.id,
        field_changed:  'monthly_rent',
        old_value:      String(currentRent),
        new_value:      String(newRent),
        effective_from: now,
        amended_by:     lease.tenant_id,
        note:           `Auto-escalation: ${rate}% annual increase`,
      },
    });

    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        monthly_rent:          newRent,
        next_escalation_date:  addMonths(lease.next_escalation_date!, 12),
      },
    });
  }

  const activeLeases = await prisma.lease.findMany({
    where:   { status: 'active', deleted_at: null },
    include: { unit: true, tenant: true },
  });

  if (activeLeases.length === 0) {
    return NextResponse.json({ message: 'No active leases', cyclesCreated: 0, chargesCreated: 0 });
  }

  const byProperty = new Map<string, typeof activeLeases>();
  for (const lease of activeLeases) {
    const list = byProperty.get(lease.unit.property_id) ?? [];
    list.push(lease);
    byProperty.set(lease.unit.property_id, list);
  }

  let cyclesCreated   = 0;
  let chargesCreated  = 0;

  for (const [propertyId, leases] of Array.from(byProperty)) {
    // Ensure the property's chart of accounts exists
    await ensurePropertyAccounts(prisma, propertyId);

    let cycle = await prisma.billingCycle.findFirst({
      where: { property_id: propertyId, cycle_month: cycleMonth },
    });

    if (!cycle) {
      cycle = await prisma.billingCycle.create({
        data: {
          property_id:     propertyId,
          cycle_month:     cycleMonth,
          readings_due_by: readingsDueBy,
          status:          'open',
        },
      });
      cyclesCreated++;
    }

    for (const lease of leases) {
      const billingStart = lease.billing_start_date ?? lease.start_date;
      if (billingStart > cycleMonth) continue;

      // Idempotency: skip if rent charge already exists for this lease+month
      const existing = await prisma.charge.findFirst({
        where: {
          lease_id:             lease.id,
          type:                 'rent',
          service_period_start: cycleMonth,
        },
      });
      if (existing) continue;

      const rent    = Number(lease.monthly_rent);
      const dueDate = new Date(now.getFullYear(), now.getMonth(), lease.rent_due_day);
      const monthLabel = cycleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Ensure the tenant's AR sub-account exists
      await ensureTenantArAccount(prisma, propertyId, lease.id, lease.tenant.full_name);

      const charge = await prisma.charge.create({
        data: {
          lease_id:             lease.id,
          type:                 'rent',
          billing_mode:         'prepaid',
          title:                `${monthLabel} Rent`,
          description:          'Monthly rent billed in advance',
          service_period_start: cycleMonth,
          service_period_end:   endOfMonth(cycleMonth),
          issue_date:           now,
          due_date:             dueDate,
          amount:               rent,
          status:               'unpaid',
        },
      });

      // Post double-entry: DR AR-tenant / CR Rent Revenue
      await postJournalEntry({
        prisma,
        propertyId,
        entryDate:   now,
        description: `Rent raised — ${monthLabel} — ${lease.tenant.full_name}`,
        refType:     'charge_raised',
        refId:       charge.id,
        lines:       chargeRaisedLines(
          arAccountCode(lease.id),
          ACCOUNTS.RENT_REVENUE.code,
          rent,
          charge.title,
        ),
      });

      chargesCreated++;
    }
  }

  return NextResponse.json({
    message:       'Monthly billing complete',
    month:         cycleMonth.toISOString().slice(0, 7),
    cyclesCreated,
    chargesCreated,
  });
}
