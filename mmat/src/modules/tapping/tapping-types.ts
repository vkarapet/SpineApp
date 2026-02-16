import type { RawTapEvent } from '../../types/assessment';

export interface TapEvent extends RawTapEvent {
  radiusX?: number;
  radiusY?: number;
}

export interface TappingSessionState {
  hand: 'left' | 'right';
  fatigue: number | null;
  medication: boolean | null;
  targetRadius: number;
  targetCenterX: number;
  targetCenterY: number;
  startTime: number;
  sessionStartISO: string;
}

export interface PracticeResult {
  validTaps: number;
  rejectedTaps: number;
}
