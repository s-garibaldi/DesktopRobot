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

export default function TunerFace() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !window.Tuner) return;

    const id = 'tuner-face-container';
    el.id = id;

    window.Tuner(`#${id}`, 'dark');

    return () => {
      window.Tuner?.destroy();
    };
  }, []);

  return (
    <div className="tuner-face" ref={containerRef} />
  );
}
