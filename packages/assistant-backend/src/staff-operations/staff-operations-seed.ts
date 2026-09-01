import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AppDataSource from '../database/data-source';
import { StaffOperationEntity } from '../database/staff-operation.entity';

async function seedStaffOperations(): Promise<void> {
  // 1. הגדרת הנתיב המדויק לקובץ הפיקסצ'ר של הלידים שיצרנו בשורש הפרויקט
  const fixturePath = resolve(__dirname, '../../../../../fixtures/staff-operations/leads.json');
  
  // 2. קריאת קובץ ה-JSON המכיל את 2 הקונים ו-2 המוכרים ופענוח המידע
  const fileContent = await readFile(fixturePath, 'utf8');
  const rawLeads = JSON.parse(fileContent) as Array<{
    id: string;
    type: 'buyer' | 'seller';
    clientName: string;
    status: string;
    requestDetails: string;
    createdAt: string;
  }>;

  // 3. אתחול חיבור למסד הנתונים דרך ה-DataSource המוגדר בפרויקט
  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(StaffOperationEntity);

  // 4. הזרקת הנתונים למסד הנתונים (Upsert מונע כפילויות לפי ה-ID)
  await repository.upsert(
    rawLeads.map((lead) => ({
      id: lead.id,
      type: lead.type,
      clientName: lead.clientName,
      status: lead.status,
      requestDetails: lead.requestDetails,
      payload: lead, // שמירת האובייקט הגולמי המלא
      createdAt: new Date(lead.createdAt),
    })),
    ['id'],
  );

  console.log(`Seeded ${rawLeads.length} staff operation lead(s) successfully.`);
  
  // 5. סגירת החיבור בסיום התהליך
  await AppDataSource.destroy();
}

// הפעלת פונקציית ה-Seed עם טיפול בשגיאות מערכת
seedStaffOperations().catch(async (error: unknown) => {
  console.error('Error seeding staff operations:', error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
