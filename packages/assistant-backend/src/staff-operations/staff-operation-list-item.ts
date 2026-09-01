/**
 * Privacy-limited lead data that the staff dashboard is allowed to display.
 */
export interface StaffOperationListItem {
  id: string;
  type: 'buyer' | 'seller';
  clientName: string;
  status: string;
  requestDetails: string;
  createdAt: Date;
}
