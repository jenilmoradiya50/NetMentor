import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

export interface DraggableFloatingPillProps {
  storageKey: string;
  defaultAlign: 'left' | 'right';
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

interface Position {
  x: number;
  y: number;
}

function clampCoordinates(x: number, y: number, width: number, height: number): Position {
  if (typeof window === 'undefined') {
    return { x, y };
  }
  const minX = 12;
  const maxX = Math.max(minX, window.innerWidth - width - 12);
  const minY = 64; // Safely below top navigation header (~53px)
  const maxY = Math.max(minY, window.innerHeight - height - 16);

  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

function getStoredPosition(storageKey: string): Position | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x === 'number' &&
      typeof parsed?.y === 'number' &&
      !isNaN(parsed.x) &&
      !isNaN(parsed.y)
    ) {
      return parsed;
    }
  } catch {
    // Gracefully handle storage errors or corrupted entries
  }
  return null;
}

function computeDefaultPosition(defaultAlign: 'left' | 'right', width = 135, height = 44): Position {
  if (typeof window === 'undefined') {
    return { x: 16, y: 600 };
  }
  const defaultX = defaultAlign === 'left' ? 16 : Math.max(12, window.innerWidth - width - 16);
  const defaultY = Math.max(64, window.innerHeight - height - 24);
  return clampCoordinates(defaultX, defaultY, width, height);
}

export const DraggableFloatingPill: React.FC<DraggableFloatingPillProps> = ({
  storageKey,
  defaultAlign,
  onClick,
  title,
  ariaLabel,
  className = '',
  children,
}) => {
  const pillRef = useRef<HTMLButtonElement | null>(null);

  // Position state initialized from localStorage with safe default
  const [pos, setPos] = useState<Position>(() => {
    const saved = getStoredPosition(storageKey);
    if (saved) return saved;
    return computeDefaultPosition(defaultAlign);
  });

  const [isDraggingState, setIsDraggingState] = useState(false);

  // References for drag lifecycle to avoid stale closure state
  const currentPosRef = useRef<Position>(pos);
  currentPosRef.current = pos;

  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<Position>(pos);
  const wasDragJustCompletedRef = useRef(false);
  const isTapRef = useRef(false);

  // Measure element dimensions and re-clamp coordinates
  const clampCurrent = useCallback(() => {
    if (!pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    const width = rect.width || 135;
    const height = rect.height || 44;

    setPos((prev) => {
      const clamped = clampCoordinates(prev.x, prev.y, width, height);
      if (clamped.x !== prev.x || clamped.y !== prev.y) {
        currentPosRef.current = clamped;
        try {
          localStorage.setItem(storageKey, JSON.stringify(clamped));
        } catch {}
        return clamped;
      }
      return prev;
    });
  }, [storageKey]);

  // Initial mount verification and window resize / orientation handler
  useEffect(() => {
    clampCurrent();

    const handleResize = () => {
      clampCurrent();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [clampCurrent]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only drag on primary pointer button (or touch)
    if (e.button !== 0) return;

    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    pointerIdRef.current = e.pointerId;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...currentPosRef.current };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported or already captured
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerDownRef.current) return;
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;

    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    const distance = Math.hypot(dx, dy);

    // If pointer travels 6px or more, engage drag mode
    if (!isDraggingRef.current && distance >= 6) {
      isDraggingRef.current = true;
      setIsDraggingState(true);
    }

    if (isDraggingRef.current) {
      const rawX = startPosRef.current.x + dx;
      const rawY = startPosRef.current.y + dy;
      const rect = pillRef.current?.getBoundingClientRect();
      const width = rect?.width || 135;
      const height = rect?.height || 44;

      const clamped = clampCoordinates(rawX, rawY, width, height);
      currentPosRef.current = clamped;
      setPos(clamped);
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    const distance = Math.hypot(dx, dy);

    if (isDraggingRef.current || distance >= 6) {
      // Drag gesture completed: suppress click and persist position
      wasDragJustCompletedRef.current = true;
      setTimeout(() => {
        wasDragJustCompletedRef.current = false;
      }, 250);

      isDraggingRef.current = false;
      setIsDraggingState(false);

      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
    } else {
      // Normal tap gesture (< 6px travel)
      isDraggingRef.current = false;
      setIsDraggingState(false);
      isTapRef.current = true;
      onClick();
      setTimeout(() => {
        isTapRef.current = false;
      }, 300);
    }
  };

  // Pointer Cancel
  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (isDraggingRef.current) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPosRef.current));
      } catch {}
    }

    isDraggingRef.current = false;
    setIsDraggingState(false);
  };

  // Fallback Click Handler (for keyboard Accessibility Enter/Space and trailing click suppression)
  const handleClick = (e: React.MouseEvent) => {
    if (wasDragJustCompletedRef.current || isTapRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <button
      ref={pillRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={title}
      className={`fixed top-0 left-0 z-40 touch-none select-none inline-flex items-center gap-2 px-3.5 h-11 rounded-full text-xs shadow-lg shadow-black/60 touch-target-44 transition-shadow will-change-transform ${
        isDraggingState
          ? 'cursor-grabbing scale-105 shadow-2xl shadow-black/90 ring-1 ring-amber-400/40'
          : 'cursor-grab hover:scale-[1.02]'
      } ${className}`}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transition: isDraggingState ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        touchAction: 'none',
      }}
    >
      <GripVertical className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
      {children}
    </button>
  );
};
