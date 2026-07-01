import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const noticesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        unit_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      return ctx.prisma.notice.findMany({
        where: {
          deleted_at: null,
          ...(input.property_id ? { property_id: input.property_id } : {}),
          ...(input.unit_id
            ? { OR: [{ unit_id: input.unit_id }, { unit_id: null }] }
            : {}),
          ...(isTenant
            ? { property: { units: { some: { leases: { some: { tenant_id: ctx.user!.id, status: 'active', deleted_at: null } } } } } }
            : { property: { owner_id: ctx.user!.id } }),
        },
        include: { creator: { select: { full_name: true } } },
        orderBy: { sent_at: 'desc' },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        unit_id: z.string().uuid().optional(),
        title_en: z.string().min(1).max(200),
        title_hi: z.string().max(200).optional(),
        body_en: z.string().min(1),
        body_hi: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.prisma.property.findFirst({
        where: { id: input.property_id, owner_id: ctx.user!.id },
      });
      if (!property) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.notice.create({
        data: {
          ...input,
          created_by: ctx.user!.id,
          sent_at: new Date(),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.notice.findFirst({
        where: { id: input.id, property: { owner_id: ctx.user!.id } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.notice.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
