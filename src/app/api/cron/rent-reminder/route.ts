import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { formatCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const dayOfMonth = today.getDate();

  // Find active leases where rent is due today or in 3 days
  const dueDays = [dayOfMonth, dayOfMonth + 3];

  const leases = await prisma.lease.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      rent_due_day: { in: dueDays },
    },
    include: {
      tenant: { select: { id: true, full_name: true } },
      unit:   { include: { property: { select: { name: true } } } },
      charges: {
        where: { status: { not: 'void' }, voided_at: null },
        select: { amount: true },
      },
      payments: {
        where: { status: 'confirmed' },
        select: { amount_paid: true },
      },
    },
  });

  let sent = 0;
  for (const lease of leases) {
    const totalCharged = lease.charges.reduce((s, c) => s + Number(c.amount), 0);
    const totalPaid    = lease.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
    const outstanding  = Math.max(0, totalCharged - totalPaid);

    if (outstanding <= 0) continue;

    const isDueToday = lease.rent_due_day === dayOfMonth;
    const isDueIn3   = lease.rent_due_day === dayOfMonth + 3;

    const title = isDueToday ? 'Rent Due Today' : 'Rent Due in 3 Days';
    const body  = `You have ${formatCurrency(outstanding)} outstanding for ${lease.unit.property.name}. ${
      isDueToday ? 'Please pay today to avoid delays.' : `Due on the ${lease.rent_due_day}th.`
    }`;

    await notifyUser(lease.tenant.id, { title, body, data: { screen: 'home' } });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
