import { MODULE_METADATA } from '@nestjs/common/constants';
import { BuyerModule } from '../buyer/buyer.module';
import { BUYER_LEAD_DASHBOARD_SOURCE } from './buyer-lead-dashboard-source';
import { StaffOperationsModule } from './staff-operations.module';
import { UnmatchedDemandBuyerLeadDashboardSource } from './unmatched-demand-buyer-lead-dashboard.source';

describe('StaffOperationsModule buyer demand wiring', () => {
  it('uses the Buyer module and unmatched-demand source instead of the fixture source', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, StaffOperationsModule) ?? [];
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, StaffOperationsModule) ?? [];

    expect(imports).toContain(BuyerModule);
    expect(providers).toContain(UnmatchedDemandBuyerLeadDashboardSource);
    expect(providers).toContainEqual({
      provide: BUYER_LEAD_DASHBOARD_SOURCE,
      useExisting: UnmatchedDemandBuyerLeadDashboardSource,
    });
  });
});
