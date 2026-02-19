import { useMemo } from 'react';
import {
  getChordOrScale,
  getChordVoicings,
  getScaleVoicings,
  ChordShape,
  ScaleShape,
} from './chordData';
import './GuitarTabsFace.css';

const EMPTY_NUM_FRETS = 4;
const EMPTY_PADDING = 24;
const EMPTY_STRING_SPACING = 28;
const EMPTY_FRET_SPACING = 36;

/** Left margin so the starting-fret number (left of top fret) is not clipped. */
const FRET_LABEL_LEFT_MARGIN = 22;
/** Fret number is shifted this much left of the grid (75% of margin). */
const FRET_LABEL_X_OFFSET = FRET_LABEL_LEFT_MARGIN * 0.75;

function EmptyTabChart() {
  const width = EMPTY_PADDING * 2 + 5 * EMPTY_STRING_SPACING;
  const height = EMPTY_PADDING * 2 + (EMPTY_NUM_FRETS + 1) * EMPTY_FRET_SPACING;
  const stringX = (i: number) => EMPTY_PADDING + i * EMPTY_STRING_SPACING;

  return (
    <svg
      viewBox={`${-FRET_LABEL_LEFT_MARGIN} 0 ${width + FRET_LABEL_LEFT_MARGIN} ${height}`}
      className="guitar-tabs-diagram empty-diagram"
      preserveAspectRatio="xMidYMid meet"
    >
      {Array.from({ length: EMPTY_NUM_FRETS + 1 }, (_, i) => (
        <line
          key={i}
          x1={EMPTY_PADDING}
          y1={EMPTY_PADDING + i * EMPTY_FRET_SPACING}
          x2={EMPTY_PADDING + 5 * EMPTY_STRING_SPACING}
          y2={EMPTY_PADDING + i * EMPTY_FRET_SPACING}
          className="diagram-line"
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1={stringX(i)}
          y1={EMPTY_PADDING}
          x2={stringX(i)}
          y2={EMPTY_PADDING + EMPTY_NUM_FRETS * EMPTY_FRET_SPACING}
          className="diagram-line"
        />
      ))}
    </svg>
  );
}

function ChordDiagram({ shape }: { shape: ChordShape }) {
  const fretOffset = shape.fretOffset ?? 1;
  const padding = 24;
  const stringSpacing = 28;
  const fretSpacing = 36;
  const dotRadius = 8;
  // Show enough frets so all notes are visible (chords-db can have 4–5 fret span)
  const maxFretInShape = Math.max(-1, ...shape.frets.filter((f) => f >= 0));
  const span = maxFretInShape >= 0 ? maxFretInShape - fretOffset + 1 : 4;
  const numFrets = Math.min(6, Math.max(4, span));
  const width = padding * 2 + 5 * stringSpacing;
  const height = padding * 2 + (numFrets + 1) * fretSpacing;

  const fretY = (fretIndex: number) => padding + (fretIndex + 0.5) * fretSpacing;
  const stringX = (stringIndex: number) => padding + stringIndex * stringSpacing;

  return (
    <svg
      viewBox={`${-FRET_LABEL_LEFT_MARGIN} 0 ${width + FRET_LABEL_LEFT_MARGIN} ${height}`}
      className="guitar-tabs-diagram chord-diagram"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line
          key={i}
          x1={padding}
          y1={padding + i * fretSpacing}
          x2={padding + 5 * stringSpacing}
          y2={padding + i * fretSpacing}
          className="diagram-line"
        />
      ))}
      {/* String lines */}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1={stringX(i)}
          y1={padding}
          x2={stringX(i)}
          y2={padding + numFrets * fretSpacing}
          className="diagram-line"
        />
      ))}
      <text x={padding - 2 - FRET_LABEL_X_OFFSET} y={padding + fretSpacing * 0.5} className="fret-label fret-label-left" textAnchor="end">
        {fretOffset}
      </text>
      {/* Barre */}
      {shape.barre &&
        shape.frets[shape.barre.fromString] === shape.barre.fret && (
          <rect
            x={stringX(shape.barre.fromString) - 6}
            y={fretY(shape.barre.fret - fretOffset) - 10}
            width={stringX(shape.barre.toString) - stringX(shape.barre.fromString) + 12}
            height={20}
            rx={10}
            className="barre"
            filter="url(#glow)"
          />
        )}
      {/* Dots and X/O */}
      {shape.frets.map((fret, stringIndex) => {
        const x = stringX(stringIndex);
        if (fret === -1) {
          return (
            <text key={stringIndex} x={x} y={padding + fretSpacing * 0.5} className="mute-label">
              ×
            </text>
          );
        }
        if (fret === 0) {
          return (
            <text key={stringIndex} x={x} y={padding + fretSpacing * 0.5} className="open-label">
              ○
            </text>
          );
        }
        const relFret = fret - fretOffset;
        if (relFret < 0 || relFret >= numFrets) return null;
        const y = fretY(relFret);
        const isBarreCovered = shape.barre && stringIndex >= shape.barre.fromString && stringIndex <= shape.barre.toString && shape.barre.fret === fret;
        if (isBarreCovered) return null;
        return (
          <circle
            key={stringIndex}
            cx={x}
            cy={y}
            r={dotRadius}
            className="finger-dot"
            filter="url(#glow)"
          />
        );
      })}
    </svg>
  );
}

function ScaleDiagram({ shape }: { shape: ScaleShape }) {
  const fretOffset = shape.fretOffset ?? 1;
  const numFrets = 5;
  const padding = 24;
  const stringSpacing = 28;
  const fretSpacing = 32;
  const dotRadius = 6;
  const width = padding * 2 + 5 * stringSpacing;
  const height = padding * 2 + (numFrets + 1) * fretSpacing;

  const fretY = (fretIndex: number) => padding + (fretIndex + 0.5) * fretSpacing;
  const stringX = (stringIndex: number) => padding + stringIndex * stringSpacing;

  return (
    <svg
      viewBox={`${-FRET_LABEL_LEFT_MARGIN} 0 ${width + FRET_LABEL_LEFT_MARGIN} ${height}`}
      className="guitar-tabs-diagram scale-diagram"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="glow-scale">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line
          key={i}
          x1={padding}
          y1={padding + i * fretSpacing}
          x2={padding + 5 * stringSpacing}
          y2={padding + i * fretSpacing}
          className="diagram-line"
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1={stringX(i)}
          y1={padding}
          x2={stringX(i)}
          y2={padding + numFrets * fretSpacing}
          className="diagram-line"
        />
      ))}
      <text x={padding - 2 - FRET_LABEL_X_OFFSET} y={padding + fretSpacing * 0.5} className="fret-label fret-label-left" textAnchor="end">
        {fretOffset}
      </text>
      {shape.positions.map((frets, stringIndex) =>
        frets.map((fret) => {
          const relFret = fret - fretOffset;
          if (relFret < 0 || relFret > numFrets) return null;
          const x = stringX(stringIndex);
          const y = fretY(relFret);
          return (
            <circle
              key={`${stringIndex}-${fret}`}
              cx={x}
              cy={y}
              r={dotRadius}
              className="scale-dot"
              filter="url(#glow-scale)"
            />
          );
        })
      )}
    </svg>
  );
}

export interface GuitarTabsFaceProps {
  /** Current chord or scale input; when empty, an empty tab chart is shown */
  input: string;
  /** For chords with multiple voicings: which voicing (0 = lowest, 1 = next up the neck, etc.) */
  voicingIndex?: number;
}

export default function GuitarTabsFace({ input, voicingIndex = 0 }: GuitarTabsFaceProps) {
  const result = useMemo(() => getChordOrScale(input), [input]);
  const chordVoicings = useMemo(() => (result?.type === 'chord' ? getChordVoicings(input) : []), [input, result?.type]);
  const scaleVoicings = useMemo(() => (result?.type === 'scale' ? getScaleVoicings(input) : []), [input, result?.type]);
  const chordShape = useMemo(() => {
    if (result?.type !== 'chord' || !chordVoicings.length) return result?.type === 'chord' ? result.shape : null;
    const idx = Math.max(0, Math.min(voicingIndex, chordVoicings.length - 1));
    return chordVoicings[idx];
  }, [result, chordVoicings, voicingIndex]);
  const scaleShape = useMemo(() => {
    if (result?.type !== 'scale' || !scaleVoicings.length) return result?.type === 'scale' ? result.shape : null;
    const idx = Math.max(0, Math.min(voicingIndex, scaleVoicings.length - 1));
    return scaleVoicings[idx];
  }, [result, scaleVoicings, voicingIndex]);
  const displayName = result
    ? result.type === 'chord'
      ? (chordShape?.name ?? result.shape.name ?? (input.trim() || '—'))
      : (scaleShape?.name ?? result.shape.name ?? '—')
    : null;
  return (
    <div className="guitar-tabs-face" data-library="chords-scales">
      <div className="guitar-tabs-display">
        <div className="guitar-tabs-inner-box" aria-hidden>
          {result ? (
            <div className="guitar-tabs-diagram-wrap">
              {result.type === 'chord' && chordShape && <ChordDiagram shape={chordShape} />}
              {result.type === 'scale' && scaleShape && (
                <ScaleDiagram key={`scale-${voicingIndex}`} shape={scaleShape} />
              )}
            </div>
          ) : (
            <div className="guitar-tabs-diagram-wrap">
              <EmptyTabChart />
            </div>
          )}
          <p className="guitar-tabs-name" aria-hidden>
            {displayName != null ? <strong>{displayName}</strong> : '\u00A0'}
          </p>
        </div>
      </div>
    </div>
  );
}
