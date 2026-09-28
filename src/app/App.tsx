import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { getAppInfo } from '@/lib/app';
import type { AppInfo } from '@/lib/bindings/AppInfo';
import './App.css';

export function App(): ReactElement {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAppInfo()
      .then((appInfo: AppInfo) => {
        if (!controller.signal.aborted) {
          setInfo(appInfo);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeError(reason));
        }
      });
    return (): void => {
      controller.abort();
    };
  }, []);

  function renderVersion(): ReactElement | null {
    if (error !== null) {
      return <p className="app-shell__error">Version nicht lesbar: {error}</p>;
    }
    if (info === null) {
      return null;
    }
    return <p className="app-shell__version">Version {info.version}</p>;
  }

  return (
    <main className="app-shell">
      <h1 className="app-shell__title">Agenten Verwalter 2000</h1>
      {renderVersion()}
    </main>
  );
}

function describeError(reason: unknown): string {
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    return String(reason.message);
  }
  return String(reason);
}
