import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('staff_operations')
export class StaffOperationEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  type!: 'buyer' | 'seller';

  @Column('text', { name: 'client_name' })
  clientName!: string;

  @Column('text')
  status!: string;

  @Column('text', { name: 'request_details' })
  requestDetails!: string;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
