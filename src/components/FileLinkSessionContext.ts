import { createContext } from 'react';

/** Session, in deren Verlauf ein Dateiverweis steht; `null` = keine, Pfade bleiben dann Text. */
export const FileLinkSessionContext = createContext<string | null>(null);
