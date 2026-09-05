// ─────────────────────────────────────────────────────────────────────────────
// Algorithm types shared across all calculators
// ─────────────────────────────────────────────────────────────────────────────

export interface AlgorithmWeights {
  // Primary component weights (from ARGOLİTMA.xlsx)
  WEIGHT_HORSE:    number; // default 45
  WEIGHT_JOCKEY:   number; // default 35
  WEIGHT_SIRE:     number; // default 8
  WEIGHT_DAM:      number; // default 6
  WEIGHT_DAMSIRE:  number; // default 2
  WEIGHT_PEDIGREE: number; // default 5   (sire/dam/damsire average weight)
  WEIGHT_EARNING:  number; // default 5
  WEIGHT_WEIGHT:   number; // default 10

  // Category thresholds (score difference from top raw score)
  THRESH_MINIMUM:  number; // default 10
  THRESH_SMALL:    number; // default 20
  THRESH_MEDIUM:   number; // default 35
  THRESH_LARGE:    number; // default 50
  THRESH_MEGA:     number; // default 70
}

export const DEFAULT_WEIGHTS: AlgorithmWeights = {
  WEIGHT_HORSE:    45,
  WEIGHT_JOCKEY:   35,
  WEIGHT_SIRE:     8,
  WEIGHT_DAM:      6,
  WEIGHT_DAMSIRE:  2,
  WEIGHT_PEDIGREE: 5,
  WEIGHT_EARNING:  5,
  WEIGHT_WEIGHT:   10,
  THRESH_MINIMUM:  10,
  THRESH_SMALL:    20,
  THRESH_MEDIUM:   35,
  THRESH_LARGE:    50,
  THRESH_MEGA:     70,
};

// ─── Entry context passed to every calculator ─────────────────────────────────

export interface RunnerContext {
  entry: {
    id: string;
    weight: number | null;
    draw: number | null;
    lastRun: string | null;     // days since last run
    form: string | null;        // e.g. "1-2-3-1-5"
    rpr: string | null;
    ts: string | null;
    ofr: string | null;
    speedRating: string | null;
    trainerLocation: string | null;
  };
  horse: {
    id: string;
    name: string;
    totalRaces: number;
    wins: number;
    seconds: number;
    thirds: number;
    fourths: number;
    totalEarnings: number;
    runsLast30d: number;
    winsLast30d: number;
    runsLast90d: number;
    winsLast90d: number;
    sirePower: number | null;
    sirePlaceRate: number | null;
    damPower: number | null;
    damPlaceRate: number | null;
    damSirePower: number | null;
    damSirePlaceRate: number | null;
    sireName: string | null;
    damName: string | null;
    damSireName: string | null;
    lastRaceDate: Date | null;
  };
  jockey: {
    id: string;
    name: string;
    totalRides: number;
    wins: number;
    seconds: number;
    thirds: number;
    fourths: number;
    winsLast30d: number;
    ridesLast30d: number;
  } | null;
  trainer: {
    id: string;
    name: string;
    totalRuns: number;
    wins: number;
    seconds: number;
    thirds: number;
    fourths: number;
    winsLast30d: number;
    runsLast30d: number;
  } | null;
  // Pedigree records fetched from DB Sire/Dam/DamSire models
  sireRecord: PedigreeRecord | null;
  damRecord: PedigreeRecord | null;
  damSireRecord: PedigreeRecord | null;
  // Field-wide context for normalisation
  field: {
    avgWeight: number;
    fieldAvgEarning: number;
    location: string;
    distance: string | null;
    surface: string | null;
    going: string | null;
  };
}

export interface PedigreeRecord {
  totalRaces: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
}

export interface ScoreBreakdown {
  horsePower:       number;
  jockeyPower:      number;
  sirePower:        number;
  damPower:         number;
  damSirePower:     number;
  pedigreePower:    number;
  earningScore:     number;
  weightScore:      number;

  // Weighted scores (power * weight)
  horseScore:       number;
  jockeyScore:      number;
  sireScore:        number;
  damScore:         number;
  damSireScore:     number;
  pedigreeScore:    number;
  earningScoreWeighted: number;
  weightScoreWeighted:  number;

  rawScore:         number;
}

export interface RankedRunner {
  entryId: string;
  horseName: string;
  rank: number;
  category: "MINIMUM" | "SMALL" | "MEDIUM" | "LARGE" | "MEGA" | null;
  scores: ScoreBreakdown;
  normalizedScore: number;
}
