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

    const id = 'tuner-face-viewport';
    el.id = id;
    const outer = el.parentElement;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'tuner-frame-debug',hypothesisId:'H4',location:'TunerFace.tsx:24',message:'tuner mount before init',data:{outerClassName:outer?.className ?? null,viewportClassName:el.className,viewportId:el.id,hasWindowTuner:Boolean(window.Tuner)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    window.Tuner(`#${id}`, 'dark');

    requestAnimationFrame(() => {
      const computedOuter = outer ? window.getComputedStyle(outer) : null;
      const computedViewport = window.getComputedStyle(el);
      const nestedTuner = el.querySelector('.tuner');
      const selfIsTuner = el.classList.contains('tuner');
      const canvas = el.querySelector('canvas');
      const target = el.querySelector('.target');
      const dial = el.querySelector('.dial');
      const marker = el.querySelector('.marker');
      const note = el.querySelector('.note');
      const help = el.querySelector('.help');
      const computedCanvas = canvas ? window.getComputedStyle(canvas) : null;
      const computedTarget = target ? window.getComputedStyle(target) : null;
      const computedDial = dial ? window.getComputedStyle(dial) : null;
      const computedMarker = marker ? window.getComputedStyle(marker) : null;
      const computedNote = note ? window.getComputedStyle(note) : null;
      const computedHelp = help ? window.getComputedStyle(help) : null;
      const computedBefore = window.getComputedStyle(el, '::before');
      const noteSpan = el.querySelector('.note .name span');
      const noteSup = el.querySelector('.note .name sup');
      const computedNoteSpan = noteSpan ? window.getComputedStyle(noteSpan) : null;
      const computedNoteSup = noteSup ? window.getComputedStyle(noteSup) : null;
      const viewportRect = el.getBoundingClientRect();
      const outerRect = outer?.getBoundingClientRect();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'tuner-frame-debug',hypothesisId:'H1',location:'TunerFace.tsx:33',message:'tuner DOM after init',data:{selfIsTuner,nestedTunerExists:Boolean(nestedTuner),viewportClassName:el.className,childCount:el.children.length,firstChildTag:el.firstElementChild?.tagName ?? null,firstChildClassName:el.firstElementChild?.className ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'tuner-frame-debug',hypothesisId:'H2_H3',location:'TunerFace.tsx:37',message:'tuner computed styles after init',data:{outerBackgroundColor:computedOuter?.backgroundColor ?? null,outerBorder:computedOuter?.border ?? null,outerBorderRadius:computedOuter?.borderRadius ?? null,viewportBackgroundColor:computedViewport.backgroundColor,viewportBorder:computedViewport.border,viewportBorderRadius:computedViewport.borderRadius,viewportWidth:computedViewport.width,viewportHeight:computedViewport.height},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'tuner-frame-debug',hypothesisId:'H5_H6_H7',location:'TunerFace.tsx:52',message:'tuner visible layer styles',data:{smallMode:el.classList.contains('small'),canvasDisplay:computedCanvas?.display ?? null,targetWidth:computedTarget?.width ?? null,targetHeight:computedTarget?.height ?? null,targetBorderBottom:computedTarget?.borderBottom ?? null,dialWidth:computedDial?.width ?? null,dialHeight:computedDial?.height ?? null,markerBorderTop:computedMarker?.borderTop ?? null,noteWidth:computedNote?.width ?? null,noteHeight:computedNote?.height ?? null,noteColor:computedNote?.color ?? null,noteSpanFontSize:computedNoteSpan?.fontSize ?? null,noteSupFontSize:computedNoteSup?.fontSize ?? null,helpDisplay:computedHelp?.display ?? null,beforeWidth:computedBefore.width,beforeHeight:computedBefore.height,beforeBorder:computedBefore.border,beforeBorderRadius:computedBefore.borderRadius},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6aae1c4b-c2f3-4f12-bcce-d9a7131e841e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'tuner-frame-debug',hypothesisId:'H8_H9_H10',location:'TunerFace.tsx:66',message:'tuner sizing source details',data:{outerRectWidth:outerRect?.width ?? null,outerRectHeight:outerRect?.height ?? null,viewportRectWidth:viewportRect.width,viewportRectHeight:viewportRect.height,computedViewportMinWidth:computedViewport.minWidth,computedViewportMinHeight:computedViewport.minHeight,computedViewportMaxWidth:computedViewport.maxWidth,computedViewportMaxHeight:computedViewport.maxHeight,computedViewportDisplay:computedViewport.display,computedViewportFlex:computedViewport.flex,computedViewportPosition:computedViewport.position,inlineStyle:el.getAttribute('style'),classList:Array.from(el.classList)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });

    return () => {
      window.Tuner?.destroy();
    };
  }, []);

  return (
    <div className="tuner-face">
      <div className="tuner-face__viewport" ref={containerRef} />
    </div>
  );
}
