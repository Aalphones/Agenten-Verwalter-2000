import type { SettingsAttention, SettingsCategoryId } from '@/features/settings/settingsCatalog';
import { useAppUpdateStore } from '@/stores/appUpdate';

const NO_ATTENTION: Partial<Record<SettingsCategoryId, SettingsAttention>> = {};
const APP_UPDATE_ATTENTION: Partial<Record<SettingsCategoryId, SettingsAttention>> = {
  app: 'update',
};

/** Welche Kategorien einen Punkt tragen. `environment` für `skills` liefert der Plan Umgebung (Phase 2). */
export function useCategoryAttention(): Partial<Record<SettingsCategoryId, SettingsAttention>> {
  const hasAppUpdate: boolean = useAppUpdateStore((state) => state.status?.hasUpdate === true);
  if (hasAppUpdate) {
    return APP_UPDATE_ATTENTION;
  }
  return NO_ATTENTION;
}
