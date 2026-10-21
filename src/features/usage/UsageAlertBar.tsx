import type { ReactElement } from 'react';
import { SeverityIcon } from '@/components/SeverityIcon';
import { useNow } from '@/features/background/useNow';
import { useUsageAlert } from '@/features/usage/useUsageAlert';
import { alertKey, alertText } from '@/features/usage/usageTexts';
import type { AlertText } from '@/features/usage/usageTexts';
import type { UsageAlert } from '@/lib/bindings/UsageAlert';
import { useUsageStore } from '@/stores/usage';
import './UsageAlertBar.css';

const ICON_SIZE = 14;

/** Leiste unter der Kopfzeile, solange Claude eine Kontingent-Warnung oder -Sperre meldet. */
export function UsageAlertBar(): ReactElement | null {
  const alert: UsageAlert | null = useUsageAlert();
  const dismissedKey: string | null = useUsageStore((state) => state.dismissedAlertKey);
  const dismissAlert = useUsageStore((state) => state.dismissAlert);
  const now: number = useNow(alert !== null);

  if (alert === null) {
    return null;
  }
  const key: string = alertKey(alert);
  if (key === dismissedKey) {
    return null;
  }
  const text: AlertText = alertText(alert, now);
  return (
    <div className="usage-alert-bar" role="status">
      <span className="usage-alert-bar__icon">
        <SeverityIcon severity="caution" size={ICON_SIZE} />
      </span>
      <p className="usage-alert-bar__text">
        <strong>{text.headline}</strong> {text.detail}
      </p>
      <button
        type="button"
        className="usage-alert-bar__dismiss"
        onClick={(): void => {
          dismissAlert(key);
        }}
      >
        Ausblenden
      </button>
    </div>
  );
}
