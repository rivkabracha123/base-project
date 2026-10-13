/** Dashboard-safe lead fields only. */
export interface StaffOperationListItem {
  id: string;
  type: 'buyer' | 'seller';
  clientName: string;
  status: string;
  category?: string;
  requestDetails: string;
  createdAt: Date;
}
