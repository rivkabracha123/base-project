import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStaffOperations1725000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "staff_operations" (
        "id" varchar PRIMARY KEY,
        "type" varchar NOT NULL,
        "client_name" varchar NOT NULL,
        "status" varchar NOT NULL,
        "request_details" text NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "staff_operations"`);
  }
}