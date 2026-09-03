/** Dashboard-safe lead fields only. */
export interface StaffOperationListItem {
  id: string;
  type: 'buyer' | 'seller';
  clientName: string;
  status: string;
  requestDetails: string;
  createdAt: Date;
}
