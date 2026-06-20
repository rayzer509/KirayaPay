import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generatePassword, sendTenantCredentials, sendTenantPasswordReset } from '@/lib/email';

export const tenantsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        status: z.enum(['active', 'all']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: {
          role: 'tenant',
          deleted_at: null,
          ...(input.property_id
            ? { leases: { some: { deleted_at: null, unit: { property_id: input.property_id } } } }
            : input.status === 'active'
            ? { leases: { some: { status: 'active', deleted_at: null } } }
            : {}),
        },
        include: {
          leases: {
            where: { deleted_at: null },
            include: {
              unit: { include: { property: true } },
            },
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: { full_name: 'asc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.prisma.user.findFirst({
        where: { id: input.id, role: 'tenant', deleted_at: null },
        include: {
          leases: {
            where: { deleted_at: null },
            include: {
              unit: { include: { property: true } },
              amendments: { orderBy: { created_at: 'desc' } },
            },
            orderBy: { created_at: 'desc' },
          },
          documents: { where: { deleted_at: null, entity_type: 'tenant' } },
        },
      });
      if (!tenant) throw new TRPCError({ code: 'NOT_FOUND' });
      return tenant;
    }),

  create: adminProcedure
    .input(
      z.object({
        full_name: z.string().min(1).max(120),
        email: z.string().email('Valid email required'),
        phone: z.string().min(10).max(15).optional(),
        preferred_lang: z.enum(['en', 'hi']).default('en'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Return existing record if email already registered as tenant
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        if (existing.role !== 'tenant') throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered as non-tenant' });
        return existing;
      }

      const supabaseAdmin = createSupabaseAdminClient();
      const password = generatePassword();

      // --- SUPABASE INVITE FLOW (commented out — switch back by uncommenting below and commenting out the Gmail block) ---
      // const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      //   input.email,
      //   { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/tenant/set-password` }
      // );
      // if (authError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Auth error: ${authError.message}` });
      // const userId = authData.user.id;

      // --- GMAIL CREDENTIALS FLOW ---
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password,
        email_confirm: true,
      });
      if (authError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Auth error: ${authError.message}` });
      const userId = authData.user.id;

      await sendTenantCredentials({
        to: input.email,
        tenantName: input.full_name,
        password,
      });

      return ctx.prisma.user.create({
        data: {
          id: userId,
          full_name: input.full_name,
          email: input.email,
          phone: input.phone,
          preferred_lang: input.preferred_lang,
          role: 'tenant',
          password_hash: '',
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        full_name: z.string().min(1).max(120).optional(),
        email: z.string().email().optional(),
        preferred_lang: z.enum(['en', 'hi']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.user.update({ where: { id }, data });
    }),

  resendInvite: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.prisma.user.findFirst({
        where: { id: input.id, role: 'tenant', deleted_at: null },
      });
      if (!tenant?.email) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });

      const supabaseAdmin = createSupabaseAdminClient();
      const password = generatePassword();

      // --- SUPABASE MAGIC LINK FLOW (commented out) ---
      // const { error } = await supabaseAdmin.auth.admin.generateLink({
      //   type: 'magiclink',
      //   email: tenant.email,
      //   options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/tenant/set-password` },
      // });
      // if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // --- GMAIL CREDENTIALS FLOW ---
      const { error } = await supabaseAdmin.auth.admin.updateUserById(tenant.id, { password });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      await sendTenantPasswordReset({
        to: tenant.email,
        tenantName: tenant.full_name,
        password,
      });

      return { ok: true };
    }),

  offboard: adminProcedure
    .input(z.object({ id: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.lease.updateMany({
        where: { tenant_id: input.id, status: 'active' },
        data: { status: 'terminated', deleted_at: new Date() },
      });
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
