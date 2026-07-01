import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { notifyUser } from '@/lib/notifications';

export const maintenanceRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed', 'all']).default('all'),
        property_id: z.string().uuid().optional(),
        unit_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      return ctx.prisma.maintenanceRequest.findMany({
        where: {
          deleted_at: null,
          ...(input.status !== 'all' ? { status: input.status } : {}),
          ...(input.unit_id ? { unit_id: input.unit_id } : {}),
          ...(isTenant
            ? { raised_by: ctx.user!.id }
            : {
                unit: {
                  ...(input.property_id ? { property_id: input.property_id } : {}),
                  property: { owner_id: ctx.user!.id },
                },
              }),
        },
        include: {
          unit: { include: { property: true } },
          raiser: { select: { full_name: true, phone: true } },
        },
        orderBy: { raised_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      const req = await ctx.prisma.maintenanceRequest.findFirst({
        where: {
          id: input.id,
          deleted_at: null,
          ...(isTenant
            ? { raised_by: ctx.user!.id }
            : { unit: { property: { owner_id: ctx.user!.id } } }),
        },
        include: {
          unit: { include: { property: true } },
          raiser: { select: { full_name: true, phone: true } },
        },
      });
      if (!req) throw new TRPCError({ code: 'NOT_FOUND' });
      return req;
    }),

  create: protectedProcedure
    .input(
      z.object({
        unit_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.prisma.unit.findFirst({
        where: { id: input.unit_id, leases: { some: { tenant_id: ctx.user!.id, status: 'active', deleted_at: null } } },
      });
      if (!unit) throw new TRPCError({ code: 'FORBIDDEN', message: 'No active lease on this unit' });
      return ctx.prisma.maintenanceRequest.create({
        data: {
          ...input,
          raised_by: ctx.user!.id,
          status: 'open',
          raised_at: new Date(),
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
        assigned_to: z.string().max(120).optional(),
        repair_cost: z.number().nonnegative().optional(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.maintenanceRequest.findFirst({
        where: { id, unit: { property: { owner_id: ctx.user!.id } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      const resolved_at =
        data.status === 'resolved' || data.status === 'closed' ? new Date() : undefined;
      const updated = await ctx.prisma.maintenanceRequest.update({
        where: { id },
        data: { ...data, ...(resolved_at ? { resolved_at } : {}) },
      });

      if (data.status && data.status !== existing.status) {
        const statusLabels: Record<string, string> = {
          assigned:    'Your request has been assigned',
          in_progress: 'Work has started on your request',
          resolved:    'Your request has been resolved',
          closed:      'Your request has been closed',
        };
        const label = statusLabels[data.status];
        if (label) {
          notifyUser(existing.raised_by, {
            title: 'Maintenance Update',
            body:  `${existing.title}: ${label}.`,
            data:  { screen: 'maintenance' },
          });
        }
      }

      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.maintenanceRequest.findFirst({
        where: { id: input.id, unit: { property: { owner_id: ctx.user!.id } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.maintenanceRequest.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
