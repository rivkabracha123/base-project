import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffOperationEntity } from '../database/staff-operation.entity';
import { StaffOperationListItem } from './staff-operation-list-item';

@Injectable()
export class StaffOperationsService {
  constructor(
    @InjectRepository(StaffOperationEntity)
    private readonly staffOpRepository: Repository<StaffOperationEntity>,
  ) {}

  // פונקציה השולפת את כל פניות הקונים והמוכרים עבור לוח הבקרה
  async findAll(): Promise<StaffOperationListItem[]> {
    const leads = await this.staffOpRepository.find({
      order: { createdAt: 'DESC' }, // סידור מהחדש לישן
    });

    // Do not expose the entity payload; future payloads may contain private domain data.
    return leads.map(({ id, type, clientName, status, requestDetails, createdAt }) => ({
      id,
      type,
      clientName,
      status,
      requestDetails,
      createdAt,
    }));
  }
}
