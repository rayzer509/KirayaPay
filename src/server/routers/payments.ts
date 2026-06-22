import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const paymentsRouter = router({
  submitUtr: protectedProcedure
    .input(
      z.object({
        bill_id: z.string().uuid(),
        upi_ref: z.string().length(12),
        amount_paid: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.payment.create({
        data: {
          bill_id: input.bill_id,
          amount_paid: input.amount_paid,
          payment_method: 'upi',
          upi_ref: input.upi_ref,
          paid_at: new Date(),
          recorded_by: ctx.user!.id,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.payment.create({
        data: {
          bill_id: input.bill_id,
          amount_paid: input.amount_paid,
          payment_method: 'cash',
          paid_at: new Date(),
          recorded_by: ctx.user!.id,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findUnique({
        where: { id: input.bill_id },
        include: { payments: true },
      });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });

      const totalPaid =
        bill.payments.reduce((s, p) => s + Number(p.amount_paid), 0) + input.amount_paid;
      const newStatus =
        totalPaid >= Number(bill.total_amount) ? 'paid' : 'partial';

      const [payment] = await ctx.prisma.$transaction([
        ctx.prisma.payment.create({
          data: {
            bill_id: input.bill_id,
            amount_paid: input.amount_paid,
            payment_method: input.payment_method,
            upi_ref: input.upi_ref,
            paid_at: new Date(),
            recorded_by: ctx.user!.id,
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
      const payment = await ctx.prisma.payment.findUnique({
        where: { id: input.payment_id },
        include: { bill: { include: { payments: true } } },
      });
      if (!payment) throw new TRPCError({ code: 'NOT_FOUND' });

      // Strip "Pending" prefix from note to mark as confirmed
      const confirmedNote = (payment.note ?? '')
        .replace(/^Pending landlord verification$/, 'Confirmed')
        .replace(/ — Pending landlord verification$/, '')
        .replace(/^Cash payment — Pending landlord verification$/, 'Cash payment confirmed')
        .trim() || 'Confirmed';

      // Recalculate bill status based on ALL payments (current + existing confirmed)
      const allPayments = payment.bill.payments;
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount_paid), 0);
      const newStatus = totalPaid >= Number(payment.bill.total_amount) ? 'paid' : 'partial';

      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.payment.update({
          where: { id: input.payment_id },
          data: { note: confirmedNote },
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
        note: { contains: 'Pending' },
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
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payment.findMany({
        where: {
          ...(input.bill_id ? { bill_id: input.bill_id } : {}),
          ...(input.property_id ? { bill: { unit: { property_id: input.property_id } } } : {}),
          ...(input.tenant_id ? { bill: { lease: { tenant_id: input.tenant_id } } } : {}),
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
      const payment = await ctx.prisma.payment.findUnique({
        where: { id: input.id },
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
