import { useState } from 'react';
import type { ReactElement } from 'react';
import { EffortDots } from '@/components/EffortDots';
import { ModelMenu } from '@/components/ModelMenu';
import {
  CHIP_LIVE_TITLE,
  CHIP_NOTE_LIVE,
  CHIP_NOTE_PLAN,
  CHIP_PLAN_SUFFIX,
  CHIP_PLAN_TITLE,
  chipResetLabel,
  chipText,
} from '@/features/implementation/implementationTexts';
import { deviatesFromPlan } from '@/features/implementation/stationState';
import { CacheAwareModelMenu } from '@/features/promptcache/CacheAwareModelMenu';
import type { Effort } from '@/lib/bindings/Effort';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { StationView } from '@/lib/bindings/StationView';
import { effortLabel, MODEL_OPTIONS, modelName } from '@/lib/labels';
import './StationModelChip.css';

const DEFAULT_EFFORT: Effort = 'medium';

interface StationModelChipProps {
  station: StationView;
  /** Session der Station; `null` vor dem Start. */
  session: SessionSummary | null;
  onPickPlan: (model: ModelId | null, effort: Effort | null) => void;
  onPickModel: (model: ModelId) => void;
  onPickEffort: (effort: Effort) => void;
}

/** Modell und Denkaufwand der Station: vor dem Start der Plan, danach die Session. Fertige Stationen zeigen nur. */
export function StationModelChip({
  station,
  session,
  onPickPlan,
  onPickModel,
  onPickEffort,
}: StationModelChipProps): ReactElement | null {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isDone: boolean = station.state === 'done';
  const isLive: boolean = session !== null && !isDone;
  const isStatic: boolean = isDone || station.byUser;
  const model: ModelId | null = session !== null && isLive ? session.model : station.model;
  const effort: Effort | null = session !== null && isLive ? session.effort : station.effort;
  const isDeviating: boolean = isLive && deviatesFromPlan(station, session);

  if (station.byUser && station.model === null && station.effort === null) {
    return null;
  }

  const text: string = chipText(model, effort);
  const modifier: string = !isLive ? 'plan' : isDeviating ? 'warn' : 'ok';
  const className: string = `station-chip station-chip--${modifier}`;
  const title: string = isLive ? CHIP_LIVE_TITLE : CHIP_PLAN_TITLE;
  const suffix: ReactElement | null = isLive ? null : (
    <span className="station-chip__suffix">{CHIP_PLAN_SUFFIX}</span>
  );
  const ariaLabel: string = `Modell: ${model === null ? 'Standard' : modelName(model)}, Denkaufwand ${effort === null ? 'Standard' : effortLabel(effort)}`;

  if (isStatic) {
    return (
      <span className={className} title={title} aria-label={ariaLabel}>
        {text}
        {suffix}
      </span>
    );
  }

  function close(): void {
    setIsOpen(false);
  }

  function resetToPlan(): void {
    if (station.model !== null) {
      onPickModel(station.model);
    }
    if (station.effort !== null) {
      onPickEffort(station.effort);
    }
  }

  function renderMenu(): ReactElement | null {
    if (!isOpen) {
      return null;
    }
    if (session === null) {
      return (
        <ModelMenu<ModelId | ''>
          options={MODEL_OPTIONS}
          value={station.model ?? ''}
          onChange={(picked: ModelId | ''): void => {
            onPickPlan(picked === '' ? null : picked, station.effort);
          }}
          onClose={close}
          placement="below"
          align="end"
          note={CHIP_NOTE_PLAN}
          leading={
            <EffortDots
              value={station.effort ?? DEFAULT_EFFORT}
              onChange={(picked: Effort): void => {
                onPickPlan(station.model, picked);
              }}
            />
          }
        />
      );
    }
    return (
      <CacheAwareModelMenu
        session={session}
        onChange={onPickModel}
        onClose={close}
        placement="below"
        align="end"
        note={CHIP_NOTE_LIVE}
        leading={
          <>
            <EffortDots value={session.effort} onChange={onPickEffort} />
            {isDeviating && (
              <button type="button" className="station-chip__reset" onClick={resetToPlan}>
                {chipResetLabel(station)}
              </button>
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="station-chip__anchor">
      <button
        type="button"
        className={className}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={(): void => {
          setIsOpen((wasOpen: boolean) => !wasOpen);
        }}
      >
        {text}
        {suffix}
      </button>
      {renderMenu()}
    </div>
  );
}
