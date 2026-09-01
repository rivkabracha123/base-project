// הגדרת מבנה נתוני הפנייה (לפי מה שהשרת מחזיר)
export interface StaffLead {
  id: string;
  type: 'buyer' | 'seller';
  clientName: string;
  status: string;
  requestDetails: string;
  createdAt: string;
}