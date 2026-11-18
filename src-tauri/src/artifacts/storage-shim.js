// Speicher-Ersatz für Artefakte (ADR 026): der Rahmen läuft ohne `allow-same-origin`, darum wirft schon
// das Lesen von `localStorage`/`sessionStorage`. Seiten, die das nicht abfangen, brachen beim Start ab.
// Läuft vor den Skripten der Seite und ersetzt beide durch einen flüchtigen Speicher im Arbeitsspeicher.
(() => {
  const memoryStorage = () => {
    const items = new Map();
    return {
      get length() { return items.size; },
      key: (index) => Array.from(items.keys())[index] ?? null,
      getItem: (key) => (items.has(String(key)) ? items.get(String(key)) : null),
      setItem: (key, value) => { items.set(String(key), String(value)); },
      removeItem: (key) => { items.delete(String(key)); },
      clear: () => { items.clear(); },
    };
  };
  ['localStorage', 'sessionStorage'].forEach((name) => {
    try {
      void window[name];
    } catch {
      try {
        Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
      } catch { /* Seite läuft ohne Ersatz weiter */ }
    }
  });
})();
