import type { ReactElement, ReactNode } from 'react';
import { ImplementationHeader } from '@/features/implementation/ImplementationHeader';
import { ReportPanel } from '@/features/implementation/ReportPanel';
import type { ImplementationView as Implementation } from '@/lib/bindings/ImplementationView';
import type { ImplementationViewKind } from '@/stores/sessions';
import './ImplementationView.css';

interface ImplementationViewProps {
  implementation: Implementation;
  projectName: string;
  activeView: ImplementationViewKind;
  hasChanges: boolean;
  changesCount: number | null;
  /** Inhalt des Reiters „Changes“ (Reichweite Vorhaben); gezeigt, wenn er aktiv ist. */
  changes: ReactNode;
  onShowView: (view: ImplementationViewKind) => void;
  onOpenProject: () => void;
}

/** Hauptfläche einer Umsetzung (ADR 048): Kopfzeile, darunter der Ablauf oder die Changes. */
export function ImplementationView({
  implementation,
  projectName,
  activeView,
  hasChanges,
  changesCount,
  changes,
  onShowView,
  onOpenProject,
}: ImplementationViewProps): ReactElement {
  function renderBody(): ReactNode {
    if (activeView === 'changes' && hasChanges) {
      return changes;
    }
    return (
      <div className="implementation-view">
        <div className="implementation-view__column">
          <ReportPanel implementation={implementation} />
        </div>
      </div>
    );
  }

  return (
    <>
      <ImplementationHeader
        implementation={implementation}
        projectName={projectName}
        activeView={activeView}
        hasChanges={hasChanges}
        changesCount={changesCount}
        onShowView={onShowView}
        onOpenProject={onOpenProject}
      />
      {renderBody()}
    </>
  );
}
