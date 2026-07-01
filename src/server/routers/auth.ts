import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import Expo from 'expo-server-sdk';

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  createProfile: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        full_name: z.string().min(1).max(120),
        phone: z.string().min(10).max(15).optional(),
        role: z.enum(['owner', 'manager', 'tenant']),
        email: z.string().email().optional(),
        preferred_lang: z.enum(['en', 'hi']).default('en'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { id: input.id } });
      if (existing) return existing;

      return ctx.prisma.user.create({
        data: {
          id: input.id,
          full_name: input.full_name,
          phone: input.phone,
          email: input.email,
          role: input.role,
          preferred_lang: input.preferred_lang,
          password_hash: '',
        },
      });
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        full_name: z.string().min(1).max(120).optional(),
        preferred_lang: z.enum(['en', 'hi']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user!.id },
        data: input,
      });
    }),

  getByPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findFirst({
        where: { phone: input.phone, deleted_at: null },
        select: { id: true, role: true, full_name: true },
      });
    }),

  registerPushToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!Expo.isExpoPushToken(input.token)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Expo push token' });
      }
      return ctx.prisma.pushToken.upsert({
        where: { token: input.token },
        create: { user_id: ctx.user!.id, token: input.token },
        update: { user_id: ctx.user!.id },
      });
    }),

  deregisterPushToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushToken.deleteMany({
        where: { token: input.token, user_id: ctx.user!.id },
      });
      return { ok: true };
    }),
});
