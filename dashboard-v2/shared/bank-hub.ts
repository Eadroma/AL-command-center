import { z } from 'zod';
const movement = z.object({ kind:z.enum(['deposit','withdraw']), item:z.string().max(80), level:z.number().int().nonnegative(), quantity:z.number().positive(), pack:z.string().max(80), at:z.number().nonnegative(), state:z.enum(['pending','confirmed','review']), evidence:z.string().max(300).optional(), before:z.object({carried:z.number().nonnegative(),bank:z.number().nonnegative()}).optional() });
export const bankHubSchema = z.object({
 version:z.literal(1), owner:z.string().max(80),phase:z.string().max(40),since:z.number().nonnegative(),visits:z.number().int().nonnegative(),persistenceError:z.boolean(),current:movement.nullable(),journal:z.array(movement).max(10),
 ledger:z.object({observedAt:z.number().nonnegative(),current:z.boolean(),durable:z.boolean(),stock:z.array(z.object({item:z.string().max(80),level:z.number().int().nonnegative(),quantity:z.number().nonnegative(),eligible:z.number().nonnegative(),minimum:z.number().nonnegative(),availableForStand:z.number().nonnegative()})).max(200),reservations:z.array(z.object({stock:z.string().max(100),purpose:z.literal('stand')})).max(100)})
});
export type BankHub = z.infer<typeof bankHubSchema>;
