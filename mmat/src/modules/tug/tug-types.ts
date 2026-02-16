export interface TugSessionSetup {
  walkingAid: 'none' | 'cane' | 'walker' | 'other';
  fatigue: number | null;
  medication: boolean | null;
  testMode: 'helper';
}

export type TugClinicalBand = 'normal' | 'moderate_risk' | 'high_risk';
