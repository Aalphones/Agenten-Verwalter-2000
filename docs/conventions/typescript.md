# TypeScript Conventions — verwalter

> **Stack** (für dieses Projekt festgelegt):
> | Layer | Choice |
> |---|---|
> | TypeScript | 5.x, strict (Flags unten) |
> | Build | Vite (über Tauri) |
> | Paketmanager | pnpm |
>
> Projektentscheidungen in dieser Datei haben Vorrang vor allgemeinen Gewohnheiten.

## Strict Mode

- `strict: true` — nicht verhandelbar
- `noUncheckedIndexedAccess: true` — Zugriff auf Array/Objekt liefert `T | undefined`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `exactOptionalPropertyTypes: true` — `{ x?: number }` heißt „fehlt oder number“, nicht „number oder undefined“
- `noImplicitOverride: true`

## Types

- Parameter- und Rückgabetypen von Funktionen immer explizit
- Typ-Inferenz für lokale Variablen ok, wenn offensichtlich
- `unknown` statt `any`; mit Type Guards eingrenzen
- Nie `as any` — wenn unvermeidbar, `as unknown as T` mit Kommentar warum

## Discriminated Unions statt Magic Strings

```ts
type SessionState =
  | { kind: 'running'; startedAt: number }
  | { kind: 'waiting'; question: string }
  | { kind: 'error'; message: string };
```

## Enums

Const-assertierte Unions statt `enum`:

```ts
export const ACTIVE_VIEW = ['chat', 'changes'] as const;
export type ActiveView = typeof ACTIVE_VIEW[number];
```

Ausnahme: generierte Typen aus dem Core (`src/lib/bindings/`) übernehmen, was der Generator erzeugt.

## Nullability

- `null` für „explizit nicht vorhanden“ (z.B. `activeSessionId: string | null`), `undefined` nur für optionale Felder
- **Kein `!` Non-Null-Assertion** — mit Type Guard eingrenzen oder umbauen

## Imports & Modules

- `import type` für reine Typ-Imports
- Keine Barrel-Files (`index.ts`-Re-Exports)
- Absolute Imports über Pfad-Alias `@/…` statt `../../../`

## Functions

- Kein `Function`-Typ — konkrete Signatur
- `Readonly<T>` / `readonly`-Arrays für Parameter, die nicht verändert werden
- Async: expliziter Rückgabetyp `Promise<T>`
- Geworfene Fehler per JSDoc dokumentieren

## Naming

- PascalCase: Typen, Interfaces, Klassen, Komponenten
- camelCase: Funktionen, Variablen, Methoden
- SCREAMING_SNAKE_CASE: echte Konstanten
- Begriffe aus [../glossary.md](../glossary.md) verwenden, keine Synonyme

## Standards statt Eigenbau

- `crypto.randomUUID()` statt selbstgebauter IDs mit `Math.random()`
- `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` statt handgebauter Zahlen- und Datumsformate („vor 2 Std.“)
- `structuredClone(value)` statt `JSON.parse(JSON.stringify(value))`
- `AbortController` / `AbortSignal` für Abbruch statt eines manuellen `isCancelled`-Flags

## Tauri-Grenze

- Aufrufe in den Core ausschließlich über typisierte Wrapper in `src/lib/` — kein verstreutes `invoke('…')` mit String-Namen in Komponenten.
- Typen, die Core und UI teilen, werden generiert (`src/lib/bindings/`) und nie von Hand geändert.

## Critical Rules

1. **Strict-Flags bleiben an** — ein abgeschaltetes Flag öffnet genau die Fehlerklasse, die ohne Tests sonst niemand fängt.
2. **Kein `any`, kein `!`** — beides schaltet den Typchecker an der Stelle ab, an der er gebraucht wird.
3. **Geteilte Typen nur generiert** — handgepflegte Kopien laufen gegen den Core auseinander.
