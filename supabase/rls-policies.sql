-- PropEase Row-Level Security Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- After running, verify in Authentication → Policies

-- ─── Helper: is the current user an admin (owner or manager)? ────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('owner', 'manager')
      AND deleted_at IS NULL
  );
$$;

-- ─── Enable RLS on all tables ────────────────────────────────────────────────
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_amendments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_cycles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_line_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;

-- ─── users ───────────────────────────────────────────────────────────────────
-- Admins see all; tenants see only themselves
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ─── properties ──────────────────────────────────────────────────────────────
-- Admins only
CREATE POLICY "properties_admin_all" ON public.properties
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── property_rates ──────────────────────────────────────────────────────────
CREATE POLICY "property_rates_admin_all" ON public.property_rates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── units ───────────────────────────────────────────────────────────────────
-- Admins: full access; tenants: read their own unit
CREATE POLICY "units_admin_all" ON public.units
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "units_tenant_select" ON public.units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.unit_id = units.id
        AND leases.tenant_id = auth.uid()
        AND leases.deleted_at IS NULL
    )
  );

-- ─── leases ──────────────────────────────────────────────────────────────────
CREATE POLICY "leases_admin_all" ON public.leases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "leases_tenant_select" ON public.leases
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

-- ─── lease_amendments ────────────────────────────────────────────────────────
CREATE POLICY "lease_amendments_admin_all" ON public.lease_amendments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "lease_amendments_tenant_select" ON public.lease_amendments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_amendments.lease_id
        AND leases.tenant_id = auth.uid()
    )
  );

-- ─── lease_templates ─────────────────────────────────────────────────────────
CREATE POLICY "lease_templates_admin_all" ON public.lease_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── billing_cycles ──────────────────────────────────────────────────────────
CREATE POLICY "billing_cycles_admin_all" ON public.billing_cycles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── meter_readings ──────────────────────────────────────────────────────────
CREATE POLICY "meter_readings_admin_all" ON public.meter_readings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── bills ───────────────────────────────────────────────────────────────────
CREATE POLICY "bills_admin_all" ON public.bills
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "bills_tenant_select" ON public.bills
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = bills.lease_id
        AND leases.tenant_id = auth.uid()
        AND leases.deleted_at IS NULL
    )
  );

-- ─── bill_line_items ─────────────────────────────────────────────────────────
CREATE POLICY "bill_line_items_admin_all" ON public.bill_line_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "bill_line_items_tenant_select" ON public.bill_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills
      JOIN public.leases ON leases.id = bills.lease_id
      WHERE bills.id = bill_line_items.bill_id
        AND leases.tenant_id = auth.uid()
    )
  );

-- ─── payments ────────────────────────────────────────────────────────────────
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can see and create payments for their own bills
CREATE POLICY "payments_tenant_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills
      JOIN public.leases ON leases.id = bills.lease_id
      WHERE bills.id = payments.bill_id
        AND leases.tenant_id = auth.uid()
    )
  );

CREATE POLICY "payments_tenant_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bills
      JOIN public.leases ON leases.id = bills.lease_id
      WHERE bills.id = bill_id
        AND leases.tenant_id = auth.uid()
    )
  );

-- ─── maintenance_requests ────────────────────────────────────────────────────
CREATE POLICY "maintenance_admin_all" ON public.maintenance_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "maintenance_tenant_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (raised_by = auth.uid());

CREATE POLICY "maintenance_tenant_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.unit_id = unit_id
        AND leases.tenant_id = auth.uid()
        AND leases.status = 'active'
        AND leases.deleted_at IS NULL
    )
  );

-- ─── documents ───────────────────────────────────────────────────────────────
CREATE POLICY "documents_admin_all" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "documents_tenant_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    entity_type = 'tenant' AND entity_id = auth.uid()
    OR (
      entity_type = 'lease' AND EXISTS (
        SELECT 1 FROM public.leases
        WHERE leases.id = documents.entity_id::uuid
          AND leases.tenant_id = auth.uid()
      )
    )
  );

-- ─── notices ─────────────────────────────────────────────────────────────────
CREATE POLICY "notices_admin_all" ON public.notices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "notices_tenant_select" ON public.notices
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- ─── messages ────────────────────────────────────────────────────────────────
CREATE POLICY "messages_admin_all" ON public.messages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "messages_tenant_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = messages.lease_id
        AND leases.tenant_id = auth.uid()
    )
  );

CREATE POLICY "messages_tenant_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_id
        AND leases.tenant_id = auth.uid()
    )
  );
