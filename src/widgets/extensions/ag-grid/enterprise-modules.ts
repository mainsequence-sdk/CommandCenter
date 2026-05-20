import { AgChartsCommunityModule } from "ag-charts-community";
import type { Module } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  SparklinesModule,
} from "ag-grid-enterprise";

const rawEnv = import.meta.env as Record<string, string | undefined>;
let enterpriseLicenseConfigured = false;

function configureAgGridEnterpriseLicense() {
  if (enterpriseLicenseConfigured) {
    return;
  }

  enterpriseLicenseConfigured = true;
  const licenseKey = rawEnv.VITE_AG_GRID_ENTERPRISE_LICENSE_KEY?.trim();

  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  }
}

configureAgGridEnterpriseLicense();

// Register Enterprise grid features and wire only Sparklines to the free AG Charts community
// runtime. Avoid AllEnterpriseModule.with(...) here because it also initialises Integrated Charts,
// while Command Center only needs chart-backed sparkline cells in Pro Table surfaces.
export const enterpriseAgGridModules = [
  AllEnterpriseModule,
  SparklinesModule.with(AgChartsCommunityModule),
] as unknown as Module[];
