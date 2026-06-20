import { router } from '../trpc';
import { authRouter } from './auth';
import { propertiesRouter } from './properties';
import { unitsRouter } from './units';
import { tenantsRouter } from './tenants';
import { leasesRouter } from './leases';
import { billingRouter } from './billing';
import { paymentsRouter } from './payments';
import { maintenanceRouter } from './maintenance';
import { noticesRouter } from './notices';
import { messagesRouter } from './messages';
import { dashboardRouter } from './dashboard';
import { templatesRouter } from './templates';
import { documentsRouter } from './documents';

export const appRouter = router({
  auth: authRouter,
  properties: propertiesRouter,
  units: unitsRouter,
  tenants: tenantsRouter,
  leases: leasesRouter,
  billing: billingRouter,
  payments: paymentsRouter,
  maintenance: maintenanceRouter,
  notices: noticesRouter,
  messages: messagesRouter,
  dashboard: dashboardRouter,
  templates: templatesRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
