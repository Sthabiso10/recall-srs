'use client';

/**
 * The playground's control panel.
 *
 * Every control here is a prop on a real component: `desiredRetention` on the
 * scheduler, `limit` and `order` on the session, `locale` on `<RecallIntl>`.
 * The page used to print those as a static list ("FSRS, retention target 0.9"),
 * which told you what the library could do without letting you feel it. Turning
 * the same three lines into controls is most of the difference between a demo
 * and a playground.
 */

import type { ReactNode } from 'react';
import { LOCALES } from '@/lib/playground-locales';
import {
  LIMIT_STEPS,
  ORDER_STEPS,
  RETENTION_STEPS,
  type PlaygroundSettings,
} from '@/lib/playground-settings';

/*
 * Four jumps, chosen to land on the four things worth seeing: tomorrow (the
 * cards you failed), three days (the ones you found merely hard), a week (a
 * "Good" card's first real interval), and a month, which is long enough that
 * reviews start counting as mature. Mature reviews are the only kind the
 * retention figure measures.
 */
const JUMPS: Array<[number, string]> = [
  [1, '1d'],
  [3, '3d'],
  [7, '1w'],
  [30, '1mo'],
];

export interface PlaygroundControlsProps {
  settings: PlaygroundSettings;
  onChange: (patch: Partial<PlaygroundSettings>) => void;
  onTravel: (days: number) => void;
  onReset: () => void;
}

export function PlaygroundControls({
  settings,
  onChange,
  onTravel,
  onReset,
}: PlaygroundControlsProps) {
  return (
    <aside className="flex flex-col gap-6 text-sm">
      {/*
        The time machine is first because it is the one control that shows the
        algorithm doing its job. Everything else tunes a demo you can already
        see; this one reveals the half you otherwise have to wait a day for.
      */}
      <Group
        label="Time machine"
        hint="Nothing here waits for tomorrow. Wind the clock and the cards you graded come back exactly when FSRS said they would."
      >
        <div className="grid grid-cols-4 gap-1.5">
          {JUMPS.map(([days, label]) => (
            <button
              key={days}
              type="button"
              onClick={() => onTravel(days)}
              className="btn btn-secondary px-0 font-mono"
            >
              +{label}
            </button>
          ))}
        </div>

        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {settings.offsetDays > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs text-accent-bright">
                +{settings.offsetDays}d
              </span>
              ahead of real time
            </>
          ) : (
            <span>Running on the real clock.</span>
          )}
        </p>
      </Group>

      <Group label="Scheduler" hint="createFSRSScheduler({ desiredRetention })">
        <Segmented
          name="retention"
          options={RETENTION_STEPS.map((value) => ({
            value: String(value),
            label: `${Math.round(value * 100)}%`,
          }))}
          value={String(settings.retention)}
          onSelect={(value) => onChange({ retention: Number(value) })}
        />
        <p className="mt-2 text-xs text-muted">
          How much you want to remember. Aim higher and every interval shortens. Watch the
          numbers on the rating buttons move.
        </p>
      </Group>

      <Group label="This sitting" hint="<StudyView session={{ limit, order }}>">
        <Segmented
          name="limit"
          options={LIMIT_STEPS.map((value) => ({
            value: String(value),
            label: String(value),
          }))}
          value={String(settings.limit)}
          onSelect={(value) => onChange({ limit: Number(value) })}
        />
        <div className="mt-1.5">
          <Segmented
            name="order"
            options={ORDER_STEPS.map((value) => ({ value, label: value }))}
            value={settings.order}
            onSelect={(value) =>
              onChange({ order: value as PlaygroundSettings['order'] })
            }
          />
        </div>
      </Group>

      <Group label="Language" hint="<RecallIntl locale>">
        <Segmented
          name="locale"
          options={LOCALES.map((locale) => ({
            value: locale.tag,
            label: locale.label,
          }))}
          value={settings.locale}
          onSelect={(value) => onChange({ locale: value })}
        />
        <p className="mt-2 text-xs text-muted">
          Intervals are formatted by <code className="font-mono">Intl</code>, so
          &ldquo;3d&rdquo; becomes &ldquo;3 j&rdquo; or &ldquo;3日&rdquo; without a
          translation table.
        </p>
      </Group>

      <div className="border-t border-line pt-4">
        <button type="button" onClick={onReset} className="btn btn-secondary">
          Reset everything
        </button>
        <p className="mt-2 text-xs text-subtle">
          Wipes all three decks and returns the clock to now.
        </p>
      </div>
    </aside>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      {hint ? (
        <p className="mb-2 mt-0.5 font-mono text-2xs leading-relaxed text-subtle">
          {hint}
        </p>
      ) : (
        <div className="mb-2" />
      )}
      {children}
    </div>
  );
}

/**
 * A radio group wearing a segmented control.
 *
 * Radios rather than buttons because that is what this is: one choice from a
 * small set, arrow-key navigable, announced as a group. The visible chrome is
 * on the label; the input itself is a peer that never renders.
 */
function Segmented({
  name,
  options,
  value,
  onSelect,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex rounded-md border border-line bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={`flex-1 cursor-pointer rounded-sm px-2 py-1 text-center text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent ${
              active
                ? 'bg-raised font-medium text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onSelect(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
