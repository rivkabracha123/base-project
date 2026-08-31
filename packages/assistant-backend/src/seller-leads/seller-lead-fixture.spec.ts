import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSellerLeadDto } from './create-seller-lead.dto';

const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json');

describe('prepared draft-enquiry fixture', () => {
  it('validates the prepared draft-enquiry fixture', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const dto = plainToInstance(CreateSellerLeadDto, fixture.request);

    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(fixture.request.contact.email).toMatch(/@example\.test$/);
  });
});
