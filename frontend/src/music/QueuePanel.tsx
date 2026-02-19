/**
 * Queue panel - list items, reorder (up/down), remove, clear.
 */
import React, { useState } from 'react';
import type { MusicQueue } from './types';

export interface QueuePanelProps {
  queue: MusicQueue;
  onRemoveAt: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onClear: () => void;
  onPlayIndex: (index: number) => void;
}

export function QueuePanel({
  queue,
  onRemoveAt,
  onMove,
  onClear,
  onPlayIndex,
}: QueuePanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (queue.items.length === 0) {
    return (
      <div className="queue-panel queue-panel-empty">
        <p>Queue is empty</p>
      </div>
    );
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      onMove(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="queue-panel">
      <div className="queue-panel-header">
        <span>Queue ({queue.items.length})</span>
        <button type="button" onClick={onClear} className="queue-clear-btn">
          Clear
        </button>
      </div>
      <ul className="queue-list">
        {queue.items.map((item, index) => (
          <li
            key={item.id}
            className={`queue-item ${index === queue.currentIndex ? 'queue-item-active' : ''} ${draggedIndex === index ? 'queue-item-dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onPlayIndex(index)}
          >
            <span className="queue-item-index">{index + 1}</span>
            {item.albumArtUrl ? (
              <img src={item.albumArtUrl} alt="" className="queue-item-art" />
            ) : (
              <div className="queue-item-art queue-item-art-placeholder" />
            )}
            <div className="queue-item-info">
              <span className="queue-item-title">{item.title}</span>
              <span className="queue-item-artist">{item.artist}</span>
            </div>
            <div className="queue-item-actions">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(index, Math.max(0, index - 1));
                }}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(index, Math.min(queue.items.length - 1, index + 1));
                }}
                disabled={index === queue.items.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAt(index);
                }}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
