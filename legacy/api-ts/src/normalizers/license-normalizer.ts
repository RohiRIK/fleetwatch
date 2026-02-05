import type { UnifiedLicenseDocument } from '../schemas/license.schema';
import { LICENSE_SKU_MAP } from '../schemas/license.schema';
import { getLicensePrice } from '../config/license-pricing';

interface FetcherOutput {
  subscribedSkus?: any[];
  [key: string]: any;
}

export class LicenseNormalizer {
  constructor(private data: FetcherOutput) {}

  public normalizeAll(): UnifiedLicenseDocument[] {
    if (!this.data.subscribedSkus) return [];

    return this.data.subscribedSkus
      .filter(sku => sku.prepaidUnits?.enabled > 0)  // Only purchased SKUs
      .map(sku => this.normalizeLicense(sku));
  }

  private normalizeLicense(sku: any): UnifiedLicenseDocument {
    const skuPartNumber = sku.skuPartNumber || 'UNKNOWN';
    const total = sku.prepaidUnits?.enabled || 0;
    const assigned = sku.consumedUnits || 0;
    const unused = total - assigned;

    // Get pricing from SSOT config
    const pricePerMonth = getLicensePrice(skuPartNumber);
    const monthlyWaste = unused * pricePerMonth;
    const annualWaste = monthlyWaste * 12;

    // Calculate utilization
    const utilizationRate = total > 0 ? (assigned / total) * 100 : 0;
    const utilizationStatus = this.getUtilizationStatus(utilizationRate);

    return {
      id: sku.skuId,
      skuId: sku.skuId,
      skuPartNumber,
      displayName: LICENSE_SKU_MAP[skuPartNumber] || skuPartNumber,

      total,
      assigned,
      unused,

      pricePerMonth,
      monthlyWaste,
      annualWaste,

      utilizationRate,
      utilizationStatus,

      servicePlans: sku.servicePlans?.map((sp: any) => ({
        servicePlanId: sp.servicePlanId,
        servicePlanName: sp.servicePlanName,
        provisioningStatus: sp.provisioningStatus,
        appliesTo: sp.appliesTo
      })),

      capabilityStatus: sku.capabilityStatus,
      prepaidUnits: {
        enabled: sku.prepaidUnits?.enabled || 0,
        suspended: sku.prepaidUnits?.suspended || 0,
        warning: sku.prepaidUnits?.warning || 0
      },

      ingestion: {
        timestamp: new Date().toISOString(),
        source: 'typescript-fetcher',
        version: '2.0.0'
      }
    };
  }

  private getUtilizationStatus(rate: number): 'optimal' | 'acceptable' | 'poor' {
    if (rate >= 90) return 'optimal';
    if (rate >= 70) return 'acceptable';
    return 'poor';
  }
}

export function normalizeLicenses(fetcherOutput: FetcherOutput): UnifiedLicenseDocument[] {
  const normalizer = new LicenseNormalizer(fetcherOutput);
  return normalizer.normalizeAll();
}
