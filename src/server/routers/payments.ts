import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { billStatusFromPayments } from '@/lib/ledger';

type PaymentContext = {
  prisma: any;
  user: { id: string; role: string } | null;
};

async function getTenantBillOrThrow(ctx: PaymentContext, billId: string) {
  const bill = await ctx.prisma.bill.findFirst({
    where: {
      id: billId,
      lease: { tenant_id: ctx.user!.id, deleted_at: null },
      status: { not: 'void' },
    },
    include: { payments: true },
  });

  if (!bill) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found for this tenant' });
  }

  return bill;
}

async function getAdminBillOrThrow(ctx: PaymentContext, billId: string) {
  const bill = await ctx.prisma.bill.findFirst({
    where: {
      id: billId,
      status: { not: 'void' },
      ...(ctx.user!.role === 'owner'
        ? { unit: { property: { owner_id: ctx.user!.id } } }
        : {}),
    },
    include: { payments: true },
  });

  if (!bill) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found for this landlord' });
  }

  return bill;
}

async function getAdminPaymentOrThrow(ctx: PaymentContext, paymentId: string) {
  const payment = await ctx.prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      bill: {
        include: {
          payments: true,
          unit: { include: { property: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }

  if (ctx.user!.role === 'owner' && payment.bill.unit.property.owner_id !== ctx.user!.id) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found for this landlord' });
  }

  return payment;
}

export const paymentsRouter = router({
  submitUtr: protectedProcedure
    .input(
      z.object({
        bill_id: z.string().uuid(),
        upi_ref: z.string().length(12),
        amount_paid: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getTenantBillOrThrow(ctx, input.bill_id);

      return ctx.prisma.payment.create({
        data: {
          bill_id: input.bill_id,
          amount_paid: input.amount_paid,
          payment_method: 'upi',
          upi_ref: input.upi_ref,
          paid_at: new Date(),
          recorded_by: ctx.user!.id,
          status: 'submitted',
          note: 'Pending landlord verification',
        },
      });
    }),

  notifyCash: protectedProcedure
    .input(
      z.object({
        bill_id: z.string().uuid(),
        amount_paid: z.number().positive(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getTenantBillOrThrow(ctx, input.bill_id);

      return ctx.prisma.payment.create({
        data: {
          bill_id: input.bill_id,
          amount_paid: input.amount_paid,
          payment_method: 'cash',
          paid_at: new Date(),
          recorded_by: ctx.user!.id,
          status: 'submitted',
          note: input.note
            ? `${input.note} — Pending landlord verification`
            : 'Cash payment — Pending landlord verification',
        },
      });
    }),

  markPaid: adminProcedure
    .input(
      z.object({
        bill_id: z.string().uuid(),
        amount_paid: z.number().positive(),
        payment_method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
        upi_ref: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await getAdminBillOrThrow(ctx, input.bill_id);
      const newStatus = billStatusFromPayments(Number(bill.total_amount), [
        ...bill.payments,
        { amount_paid: input.amount_paid, status: 'confirmed' },
      ]);

      const [payment] = await ctx.prisma.$transaction([
        ctx.prisma.payment.create({
          data: {
            bill_id: input.bill_id,
            amount_paid: input.amount_paid,
            payment_method: input.payment_method,
            upi_ref: input.upi_ref,
            paid_at: new Date(),
            recorded_by: ctx.user!.id,
            status: 'confirmed',
            verified_at: new Date(),
            verified_by: ctx.user!.id,
            note: input.note,
          },
        }),
        ctx.prisma.bill.update({
          where: { id: input.bill_id },
          data: { status: newStatus },
        }),
      ]);

      return payment;
    }),

  confirmPayment: adminProcedure
    .input(z.object({ payment_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await getAdminPaymentOrThrow(ctx, input.payment_id);
      if (payment.status === 'rejected') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Rejected payments cannot be confirmed' });
      }

      const confirmedNote =
        (payment.note ?? '')
          .replace(/^Pending landlord verification$/, 'Confirmed')
          .replace(/ — Pending landlord verification$/, '')
          .replace(/^Cash payment — Pending landlord verification$/, 'Cash payment confirmed')
          .trim() || 'Confirmed';

      const newStatus = billStatusFromPayments(
        Number(payment.bill.total_amount),
        payment.bill.payments.map((entry: { id: string }) =>
          entry.id === payment.id ? { ...entry, status: 'confirmed' } : entry,
        ),
      );

      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.payment.update({
          where: { id: input.payment_id },
          data: {
            status: 'confirmed',
            verified_at: new Date(),
            verified_by: ctx.user!.id,
            rejection_reason: null,
            note: confirmedNote,
          },
        }),
        ctx.prisma.bill.update({
          where: { id: payment.bill_id },
          data: { status: newStatus },
        }),
      ]);

      return updated;
    }),

  rejectPayment: adminProcedure
    .input(
      z.object({
        payment_id: z.string().uuid(),
        rejection_reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await getAdminPaymentOrThrow(ctx, input.payment_id);
      const newStatus = billStatusFromPayments(
        Number(payment.bill.total_amount),
        payment.bill.payments.map((entry: { id: string }) =>
          entry.id === payment.id ? { ...entry, status: 'rejected' } : entry,
        ),
      );

      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.payment.update({
          where: { id: input.payment_id },
          data: {
            status: 'rejected',
            verified_at: new Date(),
            verified_by: ctx.user!.id,
            rejection_reason: input.rejection_reason,
          },
        }),
        ctx.prisma.bill.update({
          where: { id: payment.bill_id },
          data: { status: newStatus },
        }),
      ]);

      return updated;
    }),

  pendingVerification: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.payment.findMany({
      where: {
        status: 'submitted',
        ...(ctx.user!.role === 'owner'
          ? { bill: { unit: { property: { owner_id: ctx.user!.id } } } }
          : {}),
      },
      include: {
        bill: {
          include: {
            unit: { include: { property: true } },
            lease: { include: { tenant: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  list: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        bill_id: z.string().uuid().optional(),
        tenant_id: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payment.findMany({
        where: {
          ...(input.bill_id ? { bill_id: input.bill_id } : {}),
          ...(input.property_id ? { bill: { unit: { property_id: input.property_id } } } : {}),
          ...(input.tenant_id ? { bill: { lease: { tenant_id: input.tenant_id } } } : {}),
          ...(ctx.user!.role === 'owner'
            ? { bill: { unit: { property: { owner_id: ctx.user!.id } } } }
            : {}),
        },
        include: {
          bill: {
            include: {
              unit: { include: { property: true } },
              lease: { include: { tenant: true } },
              line_items: { orderBy: { sort_order: 'asc' } },
              cycle: true,
            },
          },
          recorder: { select: { full_name: true } },
        },
        orderBy: { paid_at: 'desc' },
      });
    }),

  getReceipt: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const payment = await ctx.prisma.payment.findFirst({
        where: {
          id: input.id,
          ...(ctx.user!.role === 'owner'
            ? { bill: { unit: { property: { owner_id: ctx.user!.id } } } }
            : {}),
        },
        include: {
          bill: {
            include: {
              line_items: { orderBy: { sort_order: 'asc' } },
              unit: { include: { property: true } },
              lease: { include: { tenant: true } },
              cycle: true,
            },
          },
          recorder: { select: { full_name: true } },
        },
      });
      if (!payment) throw new TRPCError({ code: 'NOT_FOUND' });
      return payment;
    }),
});
