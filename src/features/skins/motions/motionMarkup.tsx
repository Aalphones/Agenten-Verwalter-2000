import { useId } from 'react';
import type { ReactElement } from 'react';
import { StageImage } from '@/features/skins/StageImage';
import type { Motion } from '@/lib/bindings/Motion';
import './motions.css';

/** Alle Koordinaten gelten in einer Bühne von 104 × 64; die Figur steht links. */
const VIEW_BOX = '0 0 104 64';

/** Weißer Kern, Farbe am Rand: ein vierzackiger Stern der Größe 6 um den Nullpunkt. */
const SPARKLE_PATH = 'M0 -3L0.8 -0.8L3 0L0.8 0.8L0 3L-0.8 0.8L-3 0L-0.8 -0.8Z';
const SPARKLE_POSITIONS: readonly (readonly [number, number])[] = [
  [44, 10],
  [60, 22],
  [52, 40],
  [76, 12],
  [84, 34],
  [70, 50],
];
const SPARKLE_STEP_S = 0.15;

const FROST_COLUMNS: readonly number[] = [52, 70, 88];
const FROST_STEP_S = 0.8;
/** Sechs Arme der Länge 5 um den Nullpunkt. */
const SNOWFLAKE_PATH = 'M-5 0H5M-2.5 -4.33L2.5 4.33M-2.5 4.33L2.5 -4.33';

/** Der Ring der Bewegung „Lädt auf“: Mittelpunkt und Halbmesser in Bühnenkoordinaten. */
const RING_CENTER_X = 34;
const RING_CENTER_Y = 35;
const RING_RADIUS = 29;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const RING_ARC_WITHOUT_PROGRESS = 0.25;
/** Ohne Fortschritt ist „Wird sichtbar“ zu diesem Anteil in Farbe. */
const REVEAL_FRACTION_WITHOUT_PROGRESS = 0.3;

const WAVE_PATH = 'M0 56Q6.5 52 13 56T26 56T39 56T52 56T65 56T78 56T91 56T104 56';

const NET_SPOKES: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];

interface FigureProps {
  image: string;
  isStill: boolean;
}

interface ProgressFigureProps extends FigureProps {
  /** Fortschritt 0 bis 1; `null`, solange keiner bekannt ist. */
  progress: number | null;
}

function netSpokePath(angleDegrees: number): string {
  const radians: number = (angleDegrees * Math.PI) / 180;
  const x: number = Math.cos(radians) * 10;
  const y: number = Math.sin(radians) * 10;
  return `M0 0L${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** Neutraler Ball (kein fremdes Bild): obere Hälfte im Akzent, untere hell, Mittelstrich und Knopf. */
function SummonBall(): ReactElement {
  return (
    <g className="skin-a-throw">
      <path d="M55 38a9 9 0 0 1 18 0z" fill="var(--color-accent)" />
      <path d="M55 38a9 9 0 0 0 18 0z" fill="#f0f0f0" />
      <circle cx="64" cy="38" r="9" fill="none" stroke="#333" strokeWidth="1" />
      <path d="M55 38h18" stroke="#333" strokeWidth="1" />
      <circle cx="64" cy="38" r="3" fill="#f0f0f0" stroke="#333" strokeWidth="1" />
    </g>
  );
}

/** Der Strahl braucht eine eigene Verlaufs-ID je Bühne: mehrere Bühnen stehen gleichzeitig im Fenster. */
function Beam(): ReactElement {
  const gradientId: string = useId();
  return (
    <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <rect
        className="skin-a-beam"
        x="40"
        y="28"
        width="56"
        height="4"
        rx="2"
        fill={`url(#${gradientId})`}
      />
      <circle
        className="skin-a-beam-source"
        cx="40"
        cy="30"
        r="4"
        fill="#ffffff"
        stroke="var(--color-accent)"
        strokeWidth="1"
      />
    </svg>
  );
}

function Vine({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-lean" left={2} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <path
          className="skin-a-vine"
          d="M34 30 C46 14, 62 14, 76 34"
          stroke="var(--skin-vine)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <g className="skin-a-pull">
          <rect
            x="78"
            y="38"
            width="12"
            height="15"
            rx="1"
            fill="#f4f4f4"
            stroke="#8f8f8f"
            strokeWidth=".8"
          />
          <path d="M80 42h8M80 45h8M80 48h5" stroke="#e0825c" />
        </g>
        <rect x="72" y="44" width="26" height="18" rx="2" fill="#a8742f" stroke="#5c3e15" />
        <rect
          className="skin-a-lid"
          x="72"
          y="40"
          width="26"
          height="5"
          rx="1.5"
          fill="#c08a3e"
          stroke="#5c3e15"
        />
      </svg>
    </>
  );
}

function Float({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <ellipse
          className="skin-a-aura"
          cx="32"
          cy="34"
          rx="32"
          ry="30"
          fill="none"
          stroke="var(--skin-psy)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
      </svg>
      <StageImage src={image} left={0} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <g className="skin-a-float">
          <rect
            x="78"
            y="10"
            width="20"
            height="26"
            rx="1.5"
            fill="#f4f4f4"
            stroke="var(--skin-psy)"
            strokeWidth="1.5"
          />
          <path d="M82 16h12M82 20h12M82 24h12M82 28h8" stroke="#8f8f8f" />
        </g>
      </svg>
    </>
  );
}

function Squish({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-squish" left={6} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <rect x="62" y="22" width="40" height="22" rx="3" fill="#181818" stroke="#555" />
        <text
          className="skin-a-swap-a"
          x="66"
          y="37"
          fontFamily="Consolas,monospace"
          fontSize="9"
          fill="#e0825c"
        >
          let x
        </text>
        <text
          className="skin-a-swap-b"
          x="66"
          y="37"
          fontFamily="Consolas,monospace"
          fontSize="9"
          fill="#c48ae0"
        >
          const x
        </text>
      </svg>
    </>
  );
}

function Zap({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-charge" left={0} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <rect x="66" y="20" width="36" height="28" rx="3" fill="#181818" stroke="#555" />
        <path d="M70 29l4 3-4 3" stroke="#7cc48a" strokeWidth="1.6" fill="none" />
        <rect className="skin-a-blink" x="77" y="33" width="6" height="2" fill="#7cc48a" />
        <path
          className="skin-a-zap"
          d="M46 18 L56 26 L52 28 L64 34 L56 30 L60 28 Z"
          fill="var(--skin-zap)"
          stroke="#7a5420"
          strokeWidth=".6"
        />
      </svg>
    </>
  );
}

function Fly({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <path className="skin-a-wind" d="M2 20h20" stroke="#8f8f8f" strokeWidth="1.2" />
        <path className="skin-a-wind-late" d="M0 34h16" stroke="#8f8f8f" strokeWidth="1.2" />
        <circle cx="88" cy="40" r="12" fill="none" stroke="#5aa0d8" strokeWidth="1.5" />
        <ellipse cx="88" cy="40" rx="5" ry="12" fill="none" stroke="#5aa0d8" />
      </svg>
      <StageImage src={image} motionClass="skin-a-soar" left={14} isStill={isStill} />
    </>
  );
}

function Summon({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-appear" left={44} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <circle className="skin-a-flash" cx="62" cy="40" r="18" fill="#fff" opacity="0" />
        <SummonBall />
      </svg>
    </>
  );
}

function Sleep({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-breathe" left={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <text className="skin-a-zzz" x="72" y="22" fontSize="13" fontWeight="700" fill="#8f8f8f">
          Z
        </text>
        <text
          className="skin-a-zzz-late"
          x="80"
          y="14"
          fontSize="9"
          fontWeight="700"
          fill="#8f8f8f"
        >
          z
        </text>
      </svg>
    </>
  );
}

function Ponder({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-rub" left={2} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <circle cx="50" cy="40" r="2.5" fill="#b0b0b0" />
        <circle cx="57" cy="32" r="3.5" fill="#b0b0b0" />
        <g className="skin-a-bubble">
          <rect
            x="60"
            y="2"
            width="42"
            height="26"
            rx="13"
            fill="#252526"
            stroke="#b0b0b0"
            strokeWidth="2"
          />
          <circle className="skin-a-dot" cx="71" cy="15" r="3.5" fill="#e0825c" />
          <circle
            className="skin-a-dot skin-a-dot--second"
            cx="81"
            cy="15"
            r="3.5"
            fill="#e0825c"
          />
          <circle className="skin-a-dot skin-a-dot--third" cx="91" cy="15" r="3.5" fill="#e0825c" />
        </g>
      </svg>
    </>
  );
}

function Wobble({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-wobble" left={12} bottom={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox="0 0 72 52">
        <path
          className="skin-a-star"
          d="M50 6l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z"
          fill="var(--skin-zap)"
        />
      </svg>
    </>
  );
}

interface EvolveProps extends FigureProps {
  secondImage: string | null;
}

function Evolve({ image, secondImage, isStill }: EvolveProps): ReactElement {
  if (secondImage === null) {
    return <StageImage src={image} motionClass="skin-a-popin" left={12} isStill={isStill} />;
  }
  return (
    <>
      <StageImage src={image} motionClass="skin-a-evo-a" left={12} isStill={isStill} />
      <StageImage src={secondImage} motionClass="skin-a-evo-b" left={8} isStill={isStill} />
    </>
  );
}

function WebShot({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} left={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <path
          className="skin-a-web-line"
          d="M40 30L92 22"
          stroke="#e8e8e8"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <g className="skin-a-web-net" transform="translate(92 22)">
          <g className="skin-a-web-net-inner" fill="none" stroke="#e8e8e8" strokeWidth="1">
            {NET_SPOKES.map((angle: number) => (
              <path key={angle} d={netSpokePath(angle)} />
            ))}
            <circle r="4" />
            <circle r="8" />
          </g>
        </g>
      </svg>
    </>
  );
}

function Shield({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} left={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <g className="skin-a-shield">
          <circle cx="40" cy="34" r="9" fill="var(--color-accent)" />
          <circle cx="40" cy="34" r="6" fill="#f0f0f0" />
          <circle cx="40" cy="34" r="3" fill="var(--color-accent)" />
        </g>
      </svg>
    </>
  );
}

function BeamMotion({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} left={4} isStill={isStill} />
      <Beam />
    </>
  );
}

function Sparkle({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} left={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        {SPARKLE_POSITIONS.map(([x, y]: readonly [number, number], index: number) => (
          <g key={`${String(x)}-${String(y)}`} transform={`translate(${String(x)} ${String(y)})`}>
            <path
              className="skin-a-sparkle"
              d={SPARKLE_PATH}
              fill="#ffe27a"
              style={{ animationDelay: `${String(index * SPARKLE_STEP_S)}s` }}
            />
          </g>
        ))}
      </svg>
    </>
  );
}

function Frost({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-frost-tint" left={4} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        {FROST_COLUMNS.map((x: number, index: number) => (
          <g key={x} transform={`translate(${String(x)} 0)`}>
            <path
              className="skin-a-snowflake"
              d={SNOWFLAKE_PATH}
              stroke="#bfe3ff"
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
              style={{ animationDelay: `${String(index * FROST_STEP_S)}s` }}
            />
          </g>
        ))}
      </svg>
    </>
  );
}

function Wave({ image, isStill }: FigureProps): ReactElement {
  return (
    <>
      <StageImage src={image} motionClass="skin-a-wave-bob" left={8} isStill={isStill} />
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <path
          className="skin-a-wave"
          d={WAVE_PATH}
          stroke="#5aa0d8"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </>
  );
}

/** Ring um die Figur, gefüllt bis zum Fortschritt; ohne Fortschritt dreht ein Viertelbogen. */
function Charge({ image, isStill, progress }: ProgressFigureProps): ReactElement {
  const arcFraction: number = progress ?? RING_ARC_WITHOUT_PROGRESS;
  const ringProps = {
    cx: RING_CENTER_X,
    cy: RING_CENTER_Y,
    r: RING_RADIUS,
    fill: 'none',
    strokeWidth: 4,
    transform: `rotate(-90 ${String(RING_CENTER_X)} ${String(RING_CENTER_Y)})`,
  };
  const foreground = (
    <circle
      {...ringProps}
      className="skin-a-ring-fill"
      stroke="var(--color-accent)"
      strokeLinecap="round"
      strokeDasharray={RING_LENGTH}
      strokeDashoffset={RING_LENGTH * (1 - arcFraction)}
    />
  );
  return (
    <>
      <svg className="skin-stage__overlay" viewBox={VIEW_BOX}>
        <circle {...ringProps} stroke="var(--color-border-subtle)" />
        {progress === null ? <g className="skin-a-ring-spin">{foreground}</g> : foreground}
      </svg>
      <StageImage
        src={image}
        motionClass="skin-a-ring-pulse"
        left={14}
        bottom={9}
        isStill={isStill}
      />
    </>
  );
}

/** Schattenriss, von unten bis zum Fortschritt in Farbe. */
function Reveal({ image, isStill, progress }: ProgressFigureProps): ReactElement {
  const shown: number = progress ?? REVEAL_FRACTION_WITHOUT_PROGRESS;
  return (
    <>
      <StageImage src={image} motionClass="skin-a-reveal-sil" left={8} isStill={isStill} />
      <StageImage
        src={image}
        motionClass="skin-a-reveal-col"
        left={8}
        isStill={isStill}
        extraStyle={{ clipPath: `inset(${String((1 - shown) * 100)}% 0 0 0)` }}
      />
    </>
  );
}

/**
 * Das Bild der Figur samt Zubehör für eine Bewegung, in Bühnenkoordinaten 104 × 64.
 * `secondImage` zählt nur bei „Entwicklung“, `progress` nur bei „Lädt auf“ und „Wird sichtbar“; „Läuft die
 * Strecke ab“ zeigt in der Bühne nur den Fall ohne Balken (die Figur wippt links), auf dem Balken steht sie als `rider`.
 */
export function renderMotion(
  motion: Motion,
  image: string,
  secondImage: string | null,
  isStill: boolean,
  progress: number | null = null,
): ReactElement {
  const figure: FigureProps = { image, isStill };
  switch (motion) {
    case 'vine':
      return <Vine {...figure} />;
    case 'float':
      return <Float {...figure} />;
    case 'squish':
      return <Squish {...figure} />;
    case 'zap':
      return <Zap {...figure} />;
    case 'fly':
      return <Fly {...figure} />;
    case 'summon':
      return <Summon {...figure} />;
    case 'sleep':
      return <Sleep {...figure} />;
    case 'ponder':
      return <Ponder {...figure} />;
    case 'wobble':
      return <Wobble {...figure} />;
    case 'evolve':
      return <Evolve {...figure} secondImage={secondImage} />;
    case 'popin':
      return <StageImage src={image} motionClass="skin-a-popin" left={12} isStill={isStill} />;
    case 'bob':
      return <StageImage src={image} motionClass="skin-a-bob" left={8} isStill={isStill} />;
    case 'webShot':
      return <WebShot {...figure} />;
    case 'shield':
      return <Shield {...figure} />;
    case 'beam':
      return <BeamMotion {...figure} />;
    case 'sparkle':
      return <Sparkle {...figure} />;
    case 'frost':
      return <Frost {...figure} />;
    case 'wave':
      return <Wave {...figure} />;
    case 'trek':
      return <StageImage src={image} motionClass="skin-a-trek" left={8} isStill={isStill} />;
    case 'charge':
      return <Charge {...figure} progress={progress} />;
    case 'reveal':
      return <Reveal {...figure} progress={progress} />;
    case 'none':
      return <StageImage src={image} left={8} isStill={isStill} />;
  }
}
