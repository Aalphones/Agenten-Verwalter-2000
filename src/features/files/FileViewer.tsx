import { useCallback, useRef, useState } from 'react';
import type { ReactElement, Ref } from 'react';
import { formatCount, statOf, statStamp } from '@/features/changes/changesScope';
import { DiffView } from '@/features/changes/DiffView';
import { stopStatusText } from '@/features/changes/stopNavigation';
import type { StopHandle, StopPosition } from '@/features/changes/stopNavigation';
import { useFileDiff } from '@/features/changes/useFileDiff';
import { changedLines } from '@/features/files/changedLines';
import type { ChangedLines } from '@/features/files/changedLines';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { fileSteps } from '@/features/files/fileSteps';
import type { FileStep } from '@/features/files/fileSteps';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import { variantEntry } from '@/features/files/mergeGroups';
import type { FileVariant, MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import { useCommitDiff } from '@/features/files/useCommitDiff';
import { useFileContent } from '@/features/files/useFileContent';
import { WholeFile } from '@/features/files/WholeFile';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import { openInEditor } from '@/lib/files';
import { useActionError } from '@/lib/useActionError';
import type { OpenTarget } from '@/stores/files';
import './FileViewer.css';

type FileView = 'diff' | 'file';

const PERMISSIONS_ONLY_TEXT = 'Nur Dateirechte geändert – kein Textvergleich.';
const COPIED_TEXT = 'Pfad kopiert';
const COPIED_DURATION_MS = 2000;
const SHORT_ID_LENGTH = 7;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

interface FileViewerProps {
  /** Session, über die der Core Schlüssel, Inhalt und Diff des gezeigten Stands liest. */
  sessionId: string;
  /** Session, über die der Core den Verlauf und die Schritte liest (immer das ganze Vorhaben). */
  historySessionId: string;
  reach: ChangesReach;
  group: RepoGroup;
  open: OpenTarget;
  history: ProjectHistory | null;
  scope: ChangeScope;
  canComment: boolean;
  /** Ersetzt die offene Datei (andere Fassung, Ansicht oder Schritt). */
  onOpen: (target: OpenTarget) => void;
  /** Klappt den Ordner im Baum auf; `''` ist der Knoten des Repositorys. */
  onRevealFolder: (group: string, folder: string) => void;
  onOverview: () => void;
}

/** Kilobyte oder Megabyte, je nach Größe. */
function sizeText(bytes: number): string {
  if (bytes >= BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_MB).toFixed(1).replace('.', ',')} MB`;
  }
  return `${formatCount(Math.max(1, Math.round(bytes / BYTES_PER_KB)))} KB`;
}

function stepLabel(step: FileStep): string {
  return `#${String(step.sessionNumber)} ${step.commit.shortId.slice(0, SHORT_ID_LENGTH)}`;
}

function stepTitle(step: FileStep): string {
  return `${step.sessionName}: ${step.commit.subject}`;
}

/** Die Datei des Reiters „Dateien“: Kopf, Umschalter, Schritte und der Inhalt je nach Zustand. */
export function FileViewer({
  sessionId,
  historySessionId,
  reach,
  group,
  open,
  history,
  scope,
  canComment,
  onOpen,
  onRevealFolder,
  onOverview,
}: FileViewerProps): ReactElement {
  const handleRef = useRef<StopHandle>(null);
  const [stop, setStop] = useState<StopPosition>({ position: 0, count: 0 });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { error: actionError, run } = useActionError(`${group.group}|${open.path}`);
  const handlePosition = useCallback((next: StopPosition): void => {
    setStop(next);
  }, []);

  const merged: MergedFile | undefined = group.byPath.get(open.path);
  const variant: FileVariant | undefined =
    merged?.variants.find((candidate: FileVariant) => candidate.entryKey === open.entryKey) ??
    merged?.shown;
  const entry: RepositoryChanges | undefined =
    variant === undefined ? undefined : variantEntry(group, variant);
  const entryKey: string = variant?.entryKey ?? open.entryKey;
  const isChanged: boolean = merged !== undefined && variant !== undefined && entry !== undefined;
  const view: FileView = isChanged ? (open.view ?? 'diff') : 'file';
  const steps: FileStep[] = fileSteps(history, group.group, open.path);
  const activeStep: FileStep | undefined =
    open.step === 'all'
      ? undefined
      : steps.find((candidate: FileStep) => candidate.commit.id === open.step);

  function show(change: Partial<OpenTarget>): void {
    onOpen({ ...open, ...change, line: null });
  }

  function copyPath(): void {
    navigator.clipboard
      .writeText(open.path)
      .then(() => {
        setCopiedPath(open.path);
        window.setTimeout(() => {
          setCopiedPath((current: string | null) => (current === open.path ? null : current));
        }, COPIED_DURATION_MS);
      })
      .catch((reason: unknown) => {
        console.error('Pfad kopieren fehlgeschlagen', reason);
      });
  }

  function openEditor(): void {
    const line: number | null = view === 'file' ? (handleRef.current?.topLine() ?? null) : null;
    run(() => openInEditor(sessionId, entryKey, open.path, line), 'VS Code öffnen fehlgeschlagen');
  }

  function renderCrumbs(): ReactElement {
    const parts: string[] = open.path.split('/');
    const fileName: string = parts[parts.length - 1] ?? open.path;
    const folders: string[] = parts.slice(0, -1);
    return (
      <span className="file-viewer__crumbs">
        <button
          type="button"
          className="file-viewer__crumb"
          onClick={(): void => {
            onRevealFolder(group.group, '');
          }}
        >
          {group.name}
        </button>
        {folders.map((folder: string, index: number) => (
          <span key={parts.slice(0, index + 1).join('/')} className="file-viewer__crumb-part">
            <span className="file-viewer__slash" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              className="file-viewer__crumb"
              onClick={(): void => {
                onRevealFolder(group.group, parts.slice(0, index + 1).join('/'));
              }}
            >
              {folder}
            </button>
          </span>
        ))}
        <span className="file-viewer__slash" aria-hidden="true">
          /
        </span>
        <b className="file-viewer__file-name">{fileName}</b>
      </span>
    );
  }

  function renderState(): ReactElement {
    if (variant === undefined || !isChanged) {
      return (
        <span className="file-viewer__state">
          Unverändert gegenüber <code>{group.baseRef}</code>
        </span>
      );
    }
    return (
      <span className="file-viewer__state">
        <b>Geändert</b>
        <ChangeMarks
          added={variant.stat.added}
          deleted={variant.stat.deleted}
          binary={variant.stat.binary}
        />
      </span>
    );
  }

  const viewOptions: readonly SegmentOption<FileView>[] = [
    { value: 'diff', label: 'Änderung', title: 'Was sich im Vorhaben geändert hat' },
    { value: 'file', label: 'Ganze Datei', title: 'Die Datei mit markierten geänderten Zeilen' },
  ];

  function renderHead(): ReactElement {
    return (
      <div className="file-viewer__head">
        <button
          type="button"
          className="files-button files-button--small"
          title="Zurück zur Übersicht mit Verlauf (Esc)"
          onClick={onOverview}
        >
          ← Übersicht
        </button>
        {renderCrumbs()}
        {renderState()}
        {isChanged && (
          <FilesSegment
            label="Ansicht der Datei"
            options={viewOptions}
            value={view}
            onChange={(next: FileView): void => {
              show({ view: next });
            }}
          />
        )}
        <span className="file-viewer__spacer" />
        <button type="button" className="files-button files-button--small" onClick={openEditor}>
          In VS Code öffnen
        </button>
        <button type="button" className="files-button files-button--small" onClick={copyPath}>
          Pfad kopieren
        </button>
        <span className="file-viewer__status" role="status">
          {copiedPath === open.path ? COPIED_TEXT : ''}
        </span>
      </div>
    );
  }

  function renderSteps(): ReactElement | null {
    if (!isChanged || merged === undefined) {
      return null;
    }
    const variantOptions: readonly SegmentOption<string>[] = [...merged.variants].map(
      (candidate: FileVariant): SegmentOption<string> => ({
        value: candidate.entryKey,
        label: candidate.branch,
        title: `Fassung aus ${candidate.branch}`,
      }),
    );
    const showSteps: boolean = view === 'diff';
    const hasStops: boolean = stop.count > 0;
    return (
      <div className="file-viewer__steps">
        {merged.variants.length > 1 && (
          <FilesSegment
            label="Fassung der Datei"
            options={variantOptions}
            value={variant?.entryKey ?? ''}
            onChange={(next: string): void => {
              show({ entryKey: next });
            }}
          />
        )}
        {showSteps && (
          <>
            <span className="file-viewer__steps-label">Geändert in</span>
            <button
              type="button"
              className="files-button files-button--small"
              aria-pressed={activeStep === undefined}
              data-on={activeStep === undefined ? 'true' : undefined}
              onClick={(): void => {
                show({ step: 'all', view: 'diff' });
              }}
            >
              Gesamt · {formatCount(steps.length)} {steps.length === 1 ? 'Schritt' : 'Schritte'}
            </button>
            {steps.map((step: FileStep) => (
              <button
                key={step.commit.id}
                type="button"
                className="files-button files-button--small"
                title={stepTitle(step)}
                aria-pressed={activeStep?.commit.id === step.commit.id}
                data-on={activeStep?.commit.id === step.commit.id ? 'true' : undefined}
                onClick={(): void => {
                  show({ step: step.commit.id, view: 'diff', entryKey: step.commit.key });
                }}
              >
                {stepLabel(step)}
              </button>
            ))}
          </>
        )}
        {!showSteps && hasStops && (
          <span className="file-viewer__steps-label">
            Balken links = in diesem Vorhaben geändert
          </span>
        )}
        <span className="file-viewer__spacer" />
        {hasStops && (
          <>
            <span className="file-viewer__position" role="status">
              {stopStatusText(stop)}
            </span>
            <button
              type="button"
              className="files-button files-button--small"
              title="Vorige Stelle"
              aria-label="Vorige Stelle"
              onClick={(): void => {
                handleRef.current?.step(-1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="files-button files-button--small"
              onClick={(): void => {
                handleRef.current?.step(1);
              }}
            >
              ↓ Nächste Stelle
            </button>
          </>
        )}
      </div>
    );
  }

  function renderBody(): ReactElement {
    if (view === 'diff' && variant !== undefined && entry !== undefined) {
      if (activeStep !== undefined) {
        return (
          <StepDiff
            key={activeStep.commit.id}
            sessionId={historySessionId}
            step={activeStep}
            repository={
              group.entries.find(
                (candidate: RepositoryChanges) => candidate.key === activeStep.commit.key,
              ) ?? entry
            }
            change={variant.change}
            scope={scope}
            reach={reach}
            handle={handleRef}
            onPosition={handlePosition}
          />
        );
      }
      return (
        <DiffView
          key={`${entry.key}:${open.path}:${scope}`}
          sessionId={sessionId}
          reach={reach}
          repository={entry}
          file={variant.change}
          scope={scope}
          canComment={canComment}
          showHead={false}
          emptyText={PERMISSIONS_ONLY_TEXT}
          handle={handleRef}
          onPosition={handlePosition}
        />
      );
    }
    return (
      <FileContentView
        key={`${entryKey}:${open.path}`}
        sessionId={sessionId}
        reach={reach}
        entryKey={entryKey}
        path={open.path}
        entry={isChanged ? entry : undefined}
        change={variant?.change}
        scope={scope}
        highlightLine={open.line}
        handle={handleRef}
        onPosition={handlePosition}
      />
    );
  }

  return (
    <div className="file-viewer">
      {renderHead()}
      {renderSteps()}
      {actionError !== null && <p className="file-viewer__error">{actionError}</p>}
      {renderBody()}
    </div>
  );
}

interface StepDiffProps {
  sessionId: string;
  step: FileStep;
  repository: RepositoryChanges;
  change: FileChange;
  scope: ChangeScope;
  reach: ChangesReach;
  handle: Ref<StopHandle>;
  onPosition: (stop: StopPosition) => void;
}

/** Der Diff eines einzelnen Schritts: ohne Kommentieren, ohne Aufklappen unveränderter Zeilen. */
function StepDiff({
  sessionId,
  step,
  repository,
  change,
  scope,
  reach,
  handle,
  onPosition,
}: StepDiffProps): ReactElement {
  const { diff, error, isLoading } = useCommitDiff(
    sessionId,
    step.commit.key,
    step.commit.id,
    change.path,
  );
  if (isLoading) {
    return <p className="file-viewer__notice">Schritt wird geladen …</p>;
  }
  if (error !== null || diff === null) {
    return <p className="file-viewer__error">{error ?? 'Der Schritt ließ sich nicht lesen.'}</p>;
  }
  // Ohne Zahlen: die Fremd-Hinweise der Datei gelten dem ganzen Vorhaben, nicht diesem Schritt.
  const stepFile: FileChange = { ...change, all: null, committed: null, uncommitted: null };
  return (
    <DiffView
      sessionId={sessionId}
      reach={reach}
      repository={repository}
      file={stepFile}
      scope={scope}
      canComment={false}
      showHead={false}
      lines={diff}
      emptyText={PERMISSIONS_ONLY_TEXT}
      handle={handle}
      onPosition={onPosition}
    />
  );
}

interface FileContentViewProps {
  sessionId: string;
  reach: ChangesReach;
  entryKey: string;
  path: string;
  /** Eintrag und Datei der Changes, wenn die Datei geändert ist: dann trägt die ganze Datei Markierungen. */
  entry: RepositoryChanges | undefined;
  change: FileChange | undefined;
  scope: ChangeScope;
  highlightLine: number | null;
  handle: Ref<StopHandle>;
  onPosition: (stop: StopPosition) => void;
}

function stateNotice(title: string, text: string): ReactElement {
  return (
    <div className="file-viewer__hint">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

/** Der Inhalt der Datei im Arbeitsverzeichnis: Text, Bild oder ein Hinweis zu ihrem Zustand. */
function FileContentView({
  sessionId,
  reach,
  entryKey,
  path,
  entry,
  change,
  scope,
  highlightLine,
  handle,
  onPosition,
}: FileContentViewProps): ReactElement {
  const { content, error, isLoading } = useFileContent(
    sessionId,
    entryKey,
    path,
    change?.changedAt ?? 0,
  );
  if (isLoading) {
    return <p className="file-viewer__notice">Datei wird gelesen …</p>;
  }
  if (error !== null || content === null) {
    return <p className="file-viewer__error">{error ?? 'Die Datei ließ sich nicht lesen.'}</p>;
  }
  return renderContent(content);

  function renderContent(value: FileContent): ReactElement {
    switch (value.kind) {
      case 'text':
        return (
          <>
            {value.truncated && (
              <p className="file-viewer__note">
                Nur die ersten 20.000 Zeilen von {formatCount(value.lineCount)}.
              </p>
            )}
            <MarkedFile
              sessionId={sessionId}
              reach={reach}
              text={value.text}
              path={path}
              entry={entry}
              change={change}
              scope={scope}
              highlightLine={highlightLine}
              handle={handle}
              onPosition={onPosition}
            />
          </>
        );
      case 'image':
        return (
          <div className="file-viewer__image">
            <div className="file-viewer__image-ground">
              <img src={value.dataUrl} alt={path} />
            </div>
            <span className="file-viewer__image-size">{sizeText(value.bytes)}</span>
          </div>
        );
      case 'binary':
        return stateNotice('Binärdatei – keine Vorschau', sizeText(value.bytes));
      case 'tooLarge':
        return stateNotice(
          `Zu groß zum Anzeigen (${sizeText(value.bytes)})`,
          'Öffne die Datei in VS Code.',
        );
      case 'missing':
        return stateNotice(
          'Datei gibt es nicht mehr',
          'Sie wurde gelöscht; in „Änderung“ steht, was entfernt wurde.',
        );
    }
  }
}

interface MarkedFileProps {
  sessionId: string;
  reach: ChangesReach;
  text: string;
  path: string;
  entry: RepositoryChanges | undefined;
  change: FileChange | undefined;
  scope: ChangeScope;
  highlightLine: number | null;
  handle: Ref<StopHandle>;
  onPosition: (stop: StopPosition) => void;
}

/** Die ganze Datei; bei einer geänderten Datei kommen die Markierungen aus dem Diff „Gesamt“, sobald er da ist. */
function MarkedFile({
  sessionId,
  reach,
  text,
  path,
  entry,
  change,
  scope,
  highlightLine,
  handle,
  onPosition,
}: MarkedFileProps): ReactElement {
  const isChanged: boolean = entry !== undefined && change !== undefined;
  const stat = change === undefined ? null : statOf(change, scope);
  const { diff } = useFileDiff(
    sessionId,
    reach,
    { key: entry?.key ?? '', path },
    scope,
    statStamp(stat),
    isChanged,
  );
  const marks: ChangedLines | null = marksOf(diff);
  return (
    <WholeFile
      text={text}
      path={path}
      marks={marks}
      highlightLine={highlightLine}
      scrollToLine={highlightLine}
      handle={handle}
      onPosition={onPosition}
    />
  );
}

/** Markierungen aus dem Diff; eine neue Datei (alles hinzugefügt) bekommt keine. */
function marksOf(diff: FileDiff | null): ChangedLines | null {
  if (diff === null || diff.binary || diff.lines.length === 0) {
    return null;
  }
  const lines: ChangedLines = changedLines(diff);
  if (diff.newLineCount !== null && lines.added.size === diff.newLineCount) {
    return null;
  }
  return lines;
}
