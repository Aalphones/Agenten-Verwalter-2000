import { invoke } from '@tauri-apps/api/core';
import type { AppInfo } from '@/lib/bindings/AppInfo';

/** Liest Name und Version der App aus dem Core.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wenn der Core ablehnt */
export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('app_info');
}
