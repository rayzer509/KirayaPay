import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

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
          ...(isTenant ? { raised_by: ctx.user!.id } : {}),
          ...(input.unit_id ? { unit_id: input.unit_id } : {}),
          ...(input.property_id
            ? { unit: { property_id: input.property_id } }
            : {}),
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
      const req = await ctx.prisma.maintenanceRequest.findFirst({
        where: { id: input.id, deleted_at: null },
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
      const resolved_at =
        data.status === 'resolved' || data.status === 'closed' ? new Date() : undefined;
      return ctx.prisma.maintenanceRequest.update({
        where: { id },
        data: { ...data, ...(resolved_at ? { resolved_at } : {}) },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.maintenanceRequest.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
