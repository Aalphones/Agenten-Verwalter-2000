import { createContext } from 'react';
import type { LinkSession } from '@/features/files/openFromLink';

/** Session, in deren Verlauf ein Dateiverweis steht, samt Vorhaben; `null` = keine, Pfade bleiben dann Text. */
export const FileLinkSessionContext = createContext<LinkSession | null>(null);
