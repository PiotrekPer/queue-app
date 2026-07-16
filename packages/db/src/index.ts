/**
 * @stoliq/db — DB-side helpers: the public-token generator and the hand-written
 * Supabase `Database` type. SQL migrations, RLS policies and the seed live
 * alongside this package but are not part of its importable surface.
 */
export * from './token';
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './generated/types';
