import { useEffect, useRef } from 'react';
import './TunerFace.css';

declare global {
  interface Window {
    Tuner?: {
      (containerSelector: string, theme?: string): void;
      destroy(): void;
    };
  }
}

interface TunerFaceProps {
  /** When false, omit outer shell (for transition overlay) */
  showShell?: boolean;
}

export default function TunerFace({ showShell = true }: TunerFaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !window.Tuner) return;

    const id = 'tuner-face-viewport';
    el.id = id;

    window.Tuner(`#${id}`, 'dark');

    return () => {
      window.Tuner?.destroy();
    };
  }, []);

  const inner = (
    <div className="tuner-face-inner">
      {/* Dedicated box frame ensures full rounded-rect border renders (avoids "only sides" glitch) */}
      <div className="tuner-face-box-frame" aria-hidden="true" />
      <div className="tuner-face__viewport" ref={containerRef} />
    </div>
  );

  if (!showShell) {
    return <div className="tuner-face tuner-face--shell-less tuner-face--transition">{inner}</div>;
  }

  return (
    <div className="tuner-face">
      {inner}
    </div>
  );
}
