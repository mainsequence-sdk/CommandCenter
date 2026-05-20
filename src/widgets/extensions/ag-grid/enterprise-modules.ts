import { AgChartsCommunityModule } from "ag-charts-community";
import type { Module } from "ag-grid-community";
import { AllEnterpriseModule, LicenseManager } from "ag-grid-enterprise";

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

// `ag-grid-enterprise` carries its own module typings even when versions match, so cast the
// shared Enterprise bundle to the Community module interface used by AgGridReact.
export const enterpriseAgGridModules = [
  AllEnterpriseModule.with(AgChartsCommunityModule),
] as unknown as Module[];
