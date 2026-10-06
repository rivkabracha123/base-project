import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export const paginatedResultSchema = <ItemSchema extends z.ZodTypeAny>(item: ItemSchema) =>
  z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
