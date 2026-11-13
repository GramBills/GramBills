import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ShopSettings } from '../types/pos';

export function useSettings(): ShopSettings | undefined {
  return useLiveQuery(() => db.shopSettings.toCollection().first(), []);
}
