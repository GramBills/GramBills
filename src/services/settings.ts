import { LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { nowIso } from '../lib/date';
import type { LanguageMode, ShopSettings } from '../types/pos';

export async function getShopSettings(): Promise<ShopSettings | undefined> {
  return (
    (await db.shopSettings.get(LOCAL_SHOP_ID)) ??
    db.shopSettings.toCollection().first()
  );
}

export async function updateShopSettings(
  patch: Partial<Omit<ShopSettings, 'id' | 'shopId' | 'createdAt'>>,
): Promise<void> {
  const current = await getShopSettings();
  if (!current) {
    throw new Error('Shop settings have not been initialized.');
  }
  await db.shopSettings.update(current.id, {
    ...patch,
    updatedAt: nowIso(),
    syncStatus: 'pending',
  });
}

export async function setLanguageMode(
  languageMode: LanguageMode,
): Promise<void> {
  await updateShopSettings({ languageMode });
}
