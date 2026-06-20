import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';

export const leasesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'expired', 'terminated', 'all']).default('active'),
        property_id: z.string().uuid().optional(),
        tenant_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      return ctx.prisma.lease.findMany({
        where: {
          deleted_at: null,
          ...(input.status !== 'all' ? { status: input.status } : {}),
          ...(isTenant ? { tenant_id: ctx.user!.id } : {}),
          ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
          ...(input.property_id
            ? { unit: { property_id: input.property_id } }
            : {}),
        },
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.findFirst({
        where: { id: input.id, deleted_at: null },
        include: {
          unit: { include: { property: true } },
          tenant: true,
          template: true,
          amendments: { orderBy: { created_at: 'desc' } },
          bills: {
            orderBy: { created_at: 'desc' },
            take: 6,
            include: { line_items: true, payments: true },
          },
        },
      });
      if (!lease) throw new TRPCError({ code: 'NOT_FOUND' });
      return lease;
    }),

  create: adminProcedure
    .input(
      z.object({
        unit_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        monthly_rent: z.number().positive(),
        security_deposit: z.number().nonnegative(),
        sanctioned_load_kw: z.number().positive(),
        rent_due_day: z.number().int().min(1).max(28),
        start_date: z.string(),
        end_date: z.string(),
        template_id: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.lease.findFirst({
        where: { unit_id: input.unit_id, status: 'active', deleted_at: null },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Unit already has an active lease' });

      const lease = await ctx.prisma.lease.create({
        data: {
          ...input,
          start_date: new Date(input.start_date),
          end_date: new Date(input.end_date),
          status: 'active',
        },
      });

      await ctx.prisma.unit.update({
        where: { id: input.unit_id },
        data: { status: 'occupied' },
      });

      return lease;
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.lease.update({
        where: { id: input.id },
        data: { acknowledged_at: new Date() },
      });
    }),

  amend: adminProcedure
    .input(
      z.object({
        lease_id: z.string().uuid(),
        field_changed: z.string().max(60),
        old_value: z.string(),
        new_value: z.string(),
        effective_from: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const amendment = await ctx.prisma.leaseAmendment.create({
        data: {
          lease_id: input.lease_id,
          field_changed: input.field_changed,
          old_value: input.old_value,
          new_value: input.new_value,
          effective_from: new Date(input.effective_from),
          amended_by: ctx.user!.id,
          note: input.note,
        },
      });

      const leaseUpdate: Record<string, unknown> = {};
      if (input.field_changed === 'sanctioned_load_kw') leaseUpdate.sanctioned_load_kw = parseFloat(input.new_value);
      if (input.field_changed === 'monthly_rent') leaseUpdate.monthly_rent = parseFloat(input.new_value);
      if (input.field_changed === 'end_date') leaseUpdate.end_date = new Date(input.new_value);
      if (input.field_changed === 'rent_due_day') leaseUpdate.rent_due_day = parseInt(input.new_value);

      if (Object.keys(leaseUpdate).length > 0) {
        await ctx.prisma.lease.update({ where: { id: input.lease_id }, data: leaseUpdate });
      }

      return amendment;
    }),

  terminate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.update({
        where: { id: input.id },
        data: { status: 'terminated', deleted_at: new Date() },
      });
      await ctx.prisma.unit.update({
        where: { id: lease.unit_id },
        data: { status: 'vacant' },
      });
      return lease;
    }),

  expiringIn60Days: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const in60 = addDays(now, 60);
    return ctx.prisma.lease.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        end_date: { gte: now, lte: in60 },
      },
      include: {
        unit: { include: { property: true } },
        tenant: true,
      },
    });
  }),
});
