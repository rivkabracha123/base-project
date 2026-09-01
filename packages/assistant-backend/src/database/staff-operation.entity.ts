import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('staff_operations')
export class StaffOperationEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  type!: 'buyer' | 'seller';

  // התאמה מדויקת לעמודה client_name במסד הנתונים
  @Column('text', { name: 'client_name' })
  clientName!: string;

  @Column('text')
  status!: string;

  // התאמה מדויקת לעמודה request_details במסד הנתונים
  @Column('text', { name: 'request_details' })
  requestDetails!: string;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  // התאמה מדויקת לעמודה created_at במסד הנתונים
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}