import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, Ref } from 'react';
import { formatCount, statOf, statStamp } from '@/features/changes/changesScope';
import { DiffView } from '@/features/changes/DiffView';
import { stopStatusText } from '@/features/changes/stopNavigation';
import type { StopHandle, StopPosition } from '@/features/changes/stopNavigation';
import { useFileDiff } from '@/features/changes/useFileDiff';
import { changedLines } from '@/features/files/changedLines';
import type { ChangedLines } from '@/features/files/changedLines';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { FileActions } from '@/features/files/FileActions';
import { FileCard } from '@/features/files/FileCard';
import { folderOf, nameOf, sizeText } from '@/features/files/fileFacts';
import { FileMeta } from '@/features/files/FileMeta';
import { fileSteps } from '@/features/files/fileSteps';
import type { FileStep } from '@/features/files/fileSteps';
import { kindOfPath, typeWordOf, viewModeFor } from '@/features/files/fileTypes';
import type { ViewMode } from '@/features/files/fileTypes';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import { variantEntry } from '@/features/files/mergeGroups';
import type { FileVariant, MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import { useCommitDiff } from '@/features/files/useCommitDiff';
import { useFileContent } from '@/features/files/useFileContent';
import { ViewerFrame } from '@/features/files/ViewerFrame';
import { WholeFile } from '@/features/files/WholeFile';
import type { ArtifactKind } from '@/lib/bindings/ArtifactKind';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { FileRef } from '@/lib/bindings/FileRef';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import { isExecutablePath } from '@/lib/fileLinks';
import { openFileDefault } from '@/lib/sessionFiles';
import { useActionError } from '@/lib/useActionError';
import type { FileSource, OpenTarget } from '@/stores/files';
import './FileViewer.css';

type FileView = 'diff' | 'file';
type TextOrPreview = 'text' | 'preview';

const PERMISSIONS_ONLY_TEXT = 'Nur Dateirechte geändert – kein Textvergleich.';
const SHORT_ID_LENGTH = 7;

const PREVIEW_OPTIONS: readonly SegmentOption<TextOrPreview>[] = [
  { value: 'text', label: 'Text', title: 'Den Text der Datei zeigen' },
  { value: 'preview', label: 'Vorschau', title: 'Die Datei im Betrachter zeigen' },
];

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
  /** Schalter „Vorschau“ dieser Datei (flüchtig, im Store der Ansicht). */
  preview: boolean;
  onPreview: (preview: boolean) => void;
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
  preview,
  onPreview,
}: FileViewerProps): ReactElement {
  const handleRef = useRef<StopHandle>(null);
  const lockId: string = useId();
  const [stop, setStop] = useState<StopPosition>({ position: 0, count: 0 });
  const [isMissing, setIsMissing] = useState(false);
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
  const kind: ArtifactKind = kindOfPath(open.path);
  const mode = viewModeFor('repo', kind);
  // Bild, Video, Ton und PDF zeigt der Betrachter; ein Diff dazu wäre nur „Binärdatei“.
  const defaultView: FileView = mode === 'viewer' ? 'file' : 'diff';
  const view: FileView = isChanged ? (open.view ?? defaultView) : 'file';
  const steps: FileStep[] = fileSteps(history, group.group, open.path);
  const activeStep: FileStep | undefined =
    open.step === 'all'
      ? undefined
      : steps.find((candidate: FileStep) => candidate.commit.id === open.step);
  const fileRef: FileRef = { kind: 'entry', key: entryKey, path: open.path };
  const executable: boolean = isExecutablePath(open.path);

  function show(change: Partial<OpenTarget>): void {
    onOpen({ ...open, ...change, line: null });
  }

  function topLine(): number | null {
    return view === 'file' ? (handleRef.current?.topLine() ?? null) : null;
  }

  function repoFolder(): string {
    const slash: number = open.path.lastIndexOf('/');
    return slash < 0 ? group.name : `${group.name}/${open.path.slice(0, slash)}`;
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
        {mode === 'preview' && view === 'file' && (
          <FilesSegment
            label="Text oder Vorschau"
            options={PREVIEW_OPTIONS}
            value={preview ? 'preview' : 'text'}
            onChange={(next: TextOrPreview): void => {
              onPreview(next === 'preview');
            }}
          />
        )}
        <span className="file-viewer__actions">
          <FileActions
            sessionId={sessionId}
            file={fileRef}
            copyText={open.path}
            executable={executable}
            lockId={lockId}
            isGone={isMissing}
            topLine={topLine}
            run={run}
          />
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
        source="repo"
        sessionId={sessionId}
        reach={reach}
        file={fileRef}
        kind={kind}
        preview={preview}
        bytes={null}
        modifiedAt={null}
        entry={isChanged ? entry : undefined}
        change={variant?.change}
        changedAt={variant?.change.changedAt ?? 0}
        scope={scope}
        highlightLine={open.line}
        handle={handleRef}
        onPosition={handlePosition}
        onMissing={setIsMissing}
        onOpenDefault={(): void => {
          run(() => openFileDefault(sessionId, fileRef), 'Öffnen fehlgeschlagen');
        }}
      />
    );
  }

  return (
    <div className="file-viewer">
      {renderHead()}
      <FileMeta
        folder={repoFolder()}
        bytes={null}
        modifiedAt={null}
        origin={null}
        executable={executable}
        lockId={lockId}
      />
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
  source: FileSource;
  /** „Im Browser öffnen“ der HTML-Karte: öffnet die Datei mit dem Standardprogramm. */
  onOpenDefault: () => void;
  sessionId: string;
  reach: ChangesReach;
  /** Verweis auf die Datei: ein Eintrag im Repository, bei einer Session-Datei der absolute Pfad. */
  file: FileRef;
  kind: ArtifactKind;
  /** Schalter „Vorschau“ (nur Typen mit Vorschau). */
  preview: boolean;
  /** Größe und Änderung laut Liste der Session-Dateien; im Repository `null`. */
  bytes: number | null;
  modifiedAt: number | null;
  /** Eintrag und Datei der Changes, wenn die Datei geändert ist: dann trägt die ganze Datei Markierungen. */
  entry: RepositoryChanges | undefined;
  change: FileChange | undefined;
  /** Letzte Änderung; ändert sie sich, lädt der Inhalt neu. */
  changedAt: number;
  scope: ChangeScope;
  highlightLine: number | null;
  handle: Ref<StopHandle>;
  onPosition: (stop: StopPosition) => void;
  /** Meldet, ob die Datei beim Lesen fehlte; der Kopf sperrt dann seine Knöpfe. */
  onMissing: (isMissing: boolean) => void;
}

function stateNotice(title: string, text: string): ReactElement {
  return (
    <div className="file-viewer__hint">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

/** Der Inhalt einer Datei auf der Platte je Typ: der Betrachter-Rahmen für Bild, Video, Ton, PDF und die Vorschau,
 *  die Karte „Im Browser öffnen“ für eine HTML-Seite, sonst der gelesene Text. */
export function FileContentView(props: FileContentViewProps): ReactElement {
  const { source, sessionId, file, kind, preview, bytes, modifiedAt, changedAt, onOpenDefault } =
    props;
  const mode: ViewMode = viewModeFor(source, kind);
  if (mode === 'viewer' || (mode === 'preview' && preview)) {
    return (
      <ViewerFrame sessionId={sessionId} file={file} kind={kind} bytes={bytes} stamp={changedAt} />
    );
  }
  if (mode === 'page') {
    return (
      <FileCard
        name={nameOf(file.path)}
        typeText={typeWordOf(kind, file.path)}
        bytes={bytes}
        modifiedAt={modifiedAt}
        text="HTML-Seiten öffnen im Browser."
        action={{ label: 'Im Browser öffnen', onClick: onOpenDefault }}
      />
    );
  }
  return <TextContent {...props} />;
}

/** Text der Datei, gelesen vom Core; Binärdateien und Typen ohne Ansicht bekommen eine Karte. */
function TextContent({
  source,
  sessionId,
  reach,
  file,
  kind,
  modifiedAt,
  entry,
  change,
  changedAt,
  scope,
  highlightLine,
  handle,
  onPosition,
  onMissing,
}: FileContentViewProps): ReactElement {
  const path: string = file.path;
  const entryKey: string = file.kind === 'entry' ? file.key : '';
  const { content, error, isLoading } = useFileContent(
    source,
    sessionId,
    entryKey,
    path,
    changedAt,
  );
  const isMissing: boolean = content?.kind === 'missing';
  useEffect(() => {
    onMissing(isMissing);
    return (): void => {
      onMissing(false);
    };
  }, [isMissing, onMissing]);
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
      case 'binary':
        return (
          <FileCard
            name={nameOf(path)}
            typeText={typeWordOf(kind, path)}
            bytes={value.bytes}
            modifiedAt={modifiedAt}
            text="Für diesen Typ gibt es keine Ansicht."
            action={null}
          />
        );
      case 'tooLarge':
        return stateNotice(
          `Zu groß zum Anzeigen (${sizeText(value.bytes)})`,
          'Öffne die Datei in VS Code.',
        );
      case 'missing':
        return stateNotice(
          'Datei gibt es nicht mehr',
          source === 'session'
            ? `Sie lag in ${folderOf(path)}; dort ist sie nicht mehr.`
            : 'Sie wurde gelöscht; in „Änderung“ steht, was entfernt wurde.',
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
