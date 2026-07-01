import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { arAccountCode, ensurePropertyAccounts, ensureTenantArAccount, ACCOUNTS } from '@/lib/accounts';
import { postJournalEntry, paymentConfirmedLines } from '@/lib/journal';

type Ctx = { prisma: any; user: { id: string; role: string } | null };

// ─── Auto-allocation ─────────────────────────────────────────────────────────
// Distributes a confirmed payment across outstanding charges, oldest-due first.
// Returns the list of created PaymentAllocation records.
async function allocatePayment(
  prisma: any,
  leaseId: string,
  paymentId: string,
  paymentAmount: number,
) {
  const outstandingCharges = await prisma.charge.findMany({
    where: {
      lease_id:  leaseId,
      status:    { in: ['unpaid', 'partial', 'submitted'] },
      voided_at: null,
    },
    include: {
      allocations: {
        include: { payment: { select: { status: true } } },
      },
    },
    orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
  });

  let remaining = paymentAmount;
  const createdAllocations: unknown[] = [];

  for (const charge of outstandingCharges) {
    if (remaining <= 0.001) break;

    const confirmedAllocated = charge.allocations
      .filter((a: any) => a.payment.status === 'confirmed')
      .reduce((s: number, a: any) => s + Number(a.amount), 0);

    const chargeBalance = Number(charge.amount) - confirmedAllocated;
    if (chargeBalance <= 0.001) continue;

    const allocAmount = Math.min(remaining, chargeBalance);
    remaining = Math.round((remaining - allocAmount) * 100) / 100;

    const alloc = await prisma.paymentAllocation.create({
      data: { payment_id: paymentId, charge_id: charge.id, amount: allocAmount },
    });
    createdAllocations.push(alloc);

    const newConfirmed = confirmedAllocated + allocAmount;
    const newStatus =
      newConfirmed >= Number(charge.amount) - 0.001 ? 'paid' : 'partial';
    await prisma.charge.update({
      where: { id: charge.id },
      data:  { status: newStatus },
    });
  }

  return createdAllocations;
}

// ─── Guards ──────────────────────────────────────────────────────────────────

async function getTenantLeaseOrThrow(ctx: Ctx, leaseId: string) {
  const lease = await ctx.prisma.lease.findFirst({
    where:   { id: leaseId, tenant_id: ctx.user!.id, deleted_at: null },
    include: { unit: { include: { property: true } } },
  });
  if (!lease) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lease not found' });
  return lease;
}

async function getAdminPaymentOrThrow(ctx: Ctx, paymentId: string) {
  const payment = await ctx.prisma.payment.findUnique({
    where:   { id: paymentId },
    include: {
      lease: { include: { unit: { include: { property: true } }, tenant: true } },
    },
  });
  if (!payment) throw new TRPCError({ code: 'NOT_FOUND' });
  if (payment.lease.unit.property.owner_id !== ctx.user!.id) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  return payment;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const paymentsRouter = router({

  // Tenant submits UPI UTR. Accepts bill_id (legacy bill-based UI) or lease_id
  // (new ledger-based UI). One of the two is required.
  submitUtr: protectedProcedure
    .input(z.object({
      bill_id:     z.string().uuid().optional(),
      lease_id:    z.string().uuid().optional(),
      upi_ref:     z.string().length(12),
      amount_paid: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedLeaseId: string;
      let resolvedBillId: string | null = null;

      if (input.bill_id) {
        const bill = await ctx.prisma.bill.findFirst({
          where: {
            id:     input.bill_id,
            lease:  { tenant_id: ctx.user!.id, deleted_at: null },
            status: { not: 'void' },
          },
          include: { lease: true },
        });
        if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
        resolvedLeaseId = bill.lease_id;
        resolvedBillId  = bill.id;
      } else if (input.lease_id) {
        await getTenantLeaseOrThrow(ctx, input.lease_id);
        resolvedLeaseId = input.lease_id;
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'bill_id or lease_id required' });
      }

      return ctx.prisma.payment.create({
        data: {
          bill_id:        resolvedBillId,
          lease_id:       resolvedLeaseId,
          amount_paid:    input.amount_paid,
          payment_method: 'upi',
          upi_ref:        input.upi_ref,
          paid_at:        new Date(),
          recorded_by:    ctx.user!.id,
          status:         'submitted',
          note:           'Pending landlord verification',
        },
      });
    }),

  // Tenant notifies of cash payment. Same bill_id/lease_id dual-input pattern.
  notifyCash: protectedProcedure
    .input(z.object({
      bill_id:     z.string().uuid().optional(),
      lease_id:    z.string().uuid().optional(),
      amount_paid: z.number().positive(),
      note:        z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedLeaseId: string;
      let resolvedBillId: string | null = null;

      if (input.bill_id) {
        const bill = await ctx.prisma.bill.findFirst({
          where: {
            id:     input.bill_id,
            lease:  { tenant_id: ctx.user!.id, deleted_at: null },
            status: { not: 'void' },
          },
          include: { lease: true },
        });
        if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
        resolvedLeaseId = bill.lease_id;
        resolvedBillId  = bill.id;
      } else if (input.lease_id) {
        await getTenantLeaseOrThrow(ctx, input.lease_id);
        resolvedLeaseId = input.lease_id;
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'bill_id or lease_id required' });
      }

      return ctx.prisma.payment.create({
        data: {
          bill_id:        resolvedBillId,
          lease_id:       resolvedLeaseId,
          amount_paid:    input.amount_paid,
          payment_method: 'cash',
          paid_at:        new Date(),
          recorded_by:    ctx.user!.id,
          status:         'submitted',
          note:           input.note
            ? `${input.note} — Pending landlord verification`
            : 'Cash payment — Pending landlord verification',
        },
      });
    }),

  // Landlord manually records a confirmed payment directly (no prior submission).
  // Lease-centric: allocates to oldest outstanding charges automatically.
  recordPayment: adminProcedure
    .input(z.object({
      lease_id:       z.string().uuid(),
      amount_paid:    z.number().positive(),
      payment_method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
      upi_ref:        z.string().optional(),
      note:           z.string().optional(),
      paid_at:        z.string().optional(), // ISO string; defaults to now
    }))
    .mutation(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.findUnique({
        where:   { id: input.lease_id },
        include: { unit: { include: { property: true } }, tenant: true },
      });
      if (!lease) throw new TRPCError({ code: 'NOT_FOUND' });
      if (lease.unit.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const propertyId = lease.unit.property_id;
      const now        = new Date();
      const paidAt     = input.paid_at ? new Date(input.paid_at) : now;

      await ensurePropertyAccounts(ctx.prisma, propertyId);
      await ensureTenantArAccount(ctx.prisma, propertyId, lease.id, lease.tenant.full_name);

      const payment = await ctx.prisma.payment.create({
        data: {
          lease_id:       input.lease_id,
          amount_paid:    input.amount_paid,
          payment_method: input.payment_method,
          upi_ref:        input.upi_ref,
          paid_at:        paidAt,
          recorded_by:    ctx.user!.id,
          status:         'confirmed',
          verified_at:    now,
          verified_by:    ctx.user!.id,
          note:           input.note,
        },
      });

      await allocatePayment(ctx.prisma, input.lease_id, payment.id, input.amount_paid);

      await postJournalEntry({
        prisma:      ctx.prisma,
        propertyId,
        entryDate:   paidAt,
        description: `Payment received — ${lease.tenant.full_name}`,
        refType:     'payment_confirmed',
        refId:       payment.id,
        postedBy:    ctx.user!.id,
        lines:       paymentConfirmedLines(
          arAccountCode(lease.id),
          input.amount_paid,
          input.note,
        ),
      });

      return payment;
    }),

  // Legacy: kept so the existing "Record Offline Payment" bill-picker UI continues
  // to work. Derives lease_id from the bill then delegates to recordPayment logic.
  markPaid: adminProcedure
    .input(z.object({
      bill_id:        z.string().uuid(),
      amount_paid:    z.number().positive(),
      payment_method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
      upi_ref:        z.string().optional(),
      note:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findFirst({
        where: {
          id:     input.bill_id,
          status: { not: 'void' },
          unit: { property: { owner_id: ctx.user!.id } },
        },
        include: {
          lease:  { include: { unit: { include: { property: true } }, tenant: true } },
        },
      });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });

      const lease      = bill.lease;
      const propertyId = lease.unit.property_id;
      const now        = new Date();

      await ensurePropertyAccounts(ctx.prisma, propertyId);
      await ensureTenantArAccount(ctx.prisma, propertyId, lease.id, lease.tenant.full_name);

      const payment = await ctx.prisma.payment.create({
        data: {
          bill_id:        input.bill_id,
          lease_id:       bill.lease_id,
          amount_paid:    input.amount_paid,
          payment_method: input.payment_method,
          upi_ref:        input.upi_ref,
          paid_at:        now,
          recorded_by:    ctx.user!.id,
          status:         'confirmed',
          verified_at:    now,
          verified_by:    ctx.user!.id,
          note:           input.note,
        },
      });

      await allocatePayment(ctx.prisma, lease.id, payment.id, input.amount_paid);

      await postJournalEntry({
        prisma:      ctx.prisma,
        propertyId,
        entryDate:   now,
        description: `Payment received — ${lease.tenant.full_name}`,
        refType:     'payment_confirmed',
        refId:       payment.id,
        postedBy:    ctx.user!.id,
        lines:       paymentConfirmedLines(
          arAccountCode(lease.id),
          input.amount_paid,
          input.note,
        ),
      });

      return payment;
    }),

  // Landlord confirms a tenant-submitted payment, allocates it, posts journal entry.
  confirmPayment: adminProcedure
    .input(z.object({ payment_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await getAdminPaymentOrThrow(ctx, input.payment_id);
      if (payment.status !== 'submitted') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only submitted payments can be confirmed' });
      }

      const lease      = payment.lease;
      const propertyId = lease.unit.property_id;
      const now        = new Date();

      await ensurePropertyAccounts(ctx.prisma, propertyId);
      await ensureTenantArAccount(ctx.prisma, propertyId, lease.id, lease.tenant.full_name);

      const cleanNote = (payment.note ?? '')
        .replace(/^Pending landlord verification$/, 'Confirmed')
        .replace(/ — Pending landlord verification$/, '')
        .replace(/^Cash payment — Pending landlord verification$/, 'Cash payment confirmed')
        .trim() || 'Confirmed';

      const updated = await ctx.prisma.payment.update({
        where: { id: input.payment_id },
        data:  {
          status:           'confirmed',
          verified_at:      now,
          verified_by:      ctx.user!.id,
          rejection_reason: null,
          note:             cleanNote,
        },
      });

      await allocatePayment(ctx.prisma, lease.id, payment.id, Number(payment.amount_paid));

      await postJournalEntry({
        prisma:      ctx.prisma,
        propertyId,
        entryDate:   new Date(payment.paid_at),
        description: `Payment confirmed — ${lease.tenant.full_name}`,
        refType:     'payment_confirmed',
        refId:       payment.id,
        postedBy:    ctx.user!.id,
        lines:       paymentConfirmedLines(
          arAccountCode(lease.id),
          Number(payment.amount_paid),
          cleanNote,
        ),
      });

      return updated;
    }),

  rejectPayment: adminProcedure
    .input(z.object({
      payment_id:       z.string().uuid(),
      rejection_reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const payment = await getAdminPaymentOrThrow(ctx, input.payment_id);
      if (payment.status !== 'submitted') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only submitted payments can be rejected' });
      }

      return ctx.prisma.payment.update({
        where: { id: input.payment_id },
        data:  {
          status:           'rejected',
          verified_at:      new Date(),
          verified_by:      ctx.user!.id,
          rejection_reason: input.rejection_reason,
        },
      });
    }),

  pendingVerification: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.payment.findMany({
      where: {
        status: 'submitted',
        lease: { unit: { property: { owner_id: ctx.user!.id } } },
      },
      include: {
        lease: {
          include: {
            tenant: true,
            unit:   { include: { property: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  list: adminProcedure
    .input(z.object({
      property_id: z.string().uuid().optional(),
      lease_id:    z.string().uuid().optional(),
      tenant_id:   z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payment.findMany({
        where: {
          ...(input.lease_id ? { lease_id: input.lease_id } : {}),
          lease: {
            ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
            unit: {
              ...(input.property_id ? { property_id: input.property_id } : {}),
              property: { owner_id: ctx.user!.id },
            },
          },
        },
        include: {
          lease: {
            include: {
              tenant: true,
              unit:   { include: { property: true } },
            },
          },
          allocations: { include: { charge: true } },
          recorder:    { select: { full_name: true } },
        },
        orderBy: { paid_at: 'desc' },
      });
    }),

  getReceipt: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const payment = await ctx.prisma.payment.findFirst({
        where: {
          id: input.id,
          ...(ctx.user!.role === 'tenant'
            ? { lease: { tenant_id: ctx.user!.id } }
            : { lease: { unit: { property: { owner_id: ctx.user!.id } } } }),
        },
        include: {
          lease: {
            include: {
              tenant: true,
              unit:   { include: { property: true } },
            },
          },
          allocations: {
            include: { charge: true },
            orderBy: { created_at: 'asc' },
          },
          recorder: { select: { full_name: true } },
        },
      });
      if (!payment) throw new TRPCError({ code: 'NOT_FOUND' });
      return payment;
    }),
});
