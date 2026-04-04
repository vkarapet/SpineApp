import type { RawTapEvent } from '../../types/assessment';

export interface GripEvent extends RawTapEvent {
  pointer_id: number;
}

export interface GripCycle {
  timestamp: number;
  fingers: { x: number; y: number; id: number }[];
  duration_ms: number;
}

export interface GripSessionState {
  hand: 'left' | 'right';
  fatigue: number | null;
  medication: boolean | null;
  startTime: number;
  sessionStartISO: string;
}
