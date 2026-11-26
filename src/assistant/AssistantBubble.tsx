import { lazy, Suspense, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import styles from './AssistantBubble.module.css';

const LeagueAssistantDialog = lazy(() => import('./LeagueAssistantDialog'));
const DRAG_THRESHOLD = 5;

type Position = { x: number; y: number };

interface Drag {
  pointerId: number;
  start: Position;
  position: Position;
  moved: boolean;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function AssistantBubble({ target }: { target: HTMLDivElement | null }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 1, y: 1 });
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const close = () => setOpen(false);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      position,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!area.current || !current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    const { width, height } = area.current.getBoundingClientRect();
    const button = event.currentTarget.getBoundingClientRect();
    current.moved = true;
    setDragging(true);
    setPosition({
      x: clamp(current.position.x + dx / Math.max(1, width - button.width)),
      y: clamp(current.position.y + dy / Math.max(1, height - button.height)),
    });
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setDragging(false);
  }

  const bubble = (
    <div className={styles.area} ref={area}>
      <button
        className={styles.bubble}
        type="button"
        aria-label="KI-Transferassistent öffnen"
        aria-haspopup="dialog"
        data-dragging={dragging}
        style={{
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          transform: `translate(${-position.x * 100}%, ${-position.y * 100}%)`,
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={(event) => {
          if (event.detail === 0 || !suppressClick.current) {
            setStarted(true);
            setOpen(true);
          }
          suppressClick.current = false;
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H9l-5 3v-5a7.5 7.5 0 0 1 5.5-13h4a7.5 7.5 0 0 1 7.5 7.5Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 10h8m-8 4h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      {target ? createPortal(bubble, target) : bubble}
      {started && (
        <Suspense fallback={<Modal open={open} onClose={close} title="KI-Transferassistent"><Spinner /></Modal>}>
          <LeagueAssistantDialog open={open} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
