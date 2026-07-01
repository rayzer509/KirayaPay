import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Throws NOT_FOUND unless the lease belongs to ctx.user (tenant on the lease, or owner of its property).
async function assertOwnsLeaseThread(ctx: { prisma: any; user: { id: string; role: string } | null }, leaseId: string) {
  const isTenant = ctx.user!.role === 'tenant';
  const lease = await ctx.prisma.lease.findFirst({
    where: {
      id: leaseId,
      ...(isTenant
        ? { tenant_id: ctx.user!.id }
        : { unit: { property: { owner_id: ctx.user!.id } } }),
    },
  });
  if (!lease) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lease not found' });
}

export const messagesRouter = router({
  thread: protectedProcedure
    .input(z.object({ lease_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsLeaseThread(ctx, input.lease_id);
      return ctx.prisma.message.findMany({
        where: { lease_id: input.lease_id },
        include: { sender: { select: { full_name: true, role: true } } },
        orderBy: { sent_at: 'asc' },
      });
    }),

  send: protectedProcedure
    .input(z.object({ lease_id: z.string().uuid(), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnsLeaseThread(ctx, input.lease_id);
      return ctx.prisma.message.create({
        data: {
          lease_id: input.lease_id,
          sender_id: ctx.user!.id,
          body: input.body,
          sent_at: new Date(),
        },
        include: { sender: { select: { full_name: true, role: true } } },
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ lease_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnsLeaseThread(ctx, input.lease_id);
      return ctx.prisma.message.updateMany({
        where: {
          lease_id: input.lease_id,
          sender_id: { not: ctx.user!.id },
          read_at: null,
        },
        data: { read_at: new Date() },
      });
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const leases = await ctx.prisma.lease.findMany({
      where: { tenant_id: ctx.user!.id, status: 'active' },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);
    return ctx.prisma.message.count({
      where: {
        lease_id: { in: leaseIds },
        sender_id: { not: ctx.user!.id },
        read_at: null,
      },
    });
  }),
});
