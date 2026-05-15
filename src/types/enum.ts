// ─── Auth ────────────────────────────────────────────────────────────────────

export enum Role {
  USER  = "USER",
  ADMIN = "ADMIN",
}

// ─── Fantasy UFC ─────────────────────────────────────────────────────────────

export enum LeagueStatus {
  DRAFTING  = "DRAFTING",
  ACTIVE    = "ACTIVE",
  LOCKED    = "LOCKED",
  COMPLETED = "COMPLETED",
  ARCHIVED  = "ARCHIVED",
}

export enum EventStatus {
  UPCOMING  = "UPCOMING",
  ONGOING   = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum DraftStatus {
  WAITING   = "WAITING",
  OPEN      = "OPEN",
  DRAFTING  = "DRAFTING",
  COMPLETED = "COMPLETED",
}

export enum BoutResult {
  KO_TKO             = "KO_TKO",
  SUBMISSION         = "SUBMISSION",
  DECISION_UNANIMOUS = "DECISION_UNANIMOUS",
  DECISION_SPLIT     = "DECISION_SPLIT",
  DECISION_MAJORITY  = "DECISION_MAJORITY",
  DRAW               = "DRAW",
  NO_CONTEST         = "NO_CONTEST",
  DQ                 = "DQ",
}

export enum NotificationType {
  DRAFT_STARTING = "DRAFT_STARTING",
  DRAFT_PICK     = "DRAFT_PICK",
  RESULTS_POSTED = "RESULTS_POSTED",
  LEAGUE_INVITE  = "LEAGUE_INVITE",
  TRADE_OFFER    = "TRADE_OFFER",
  TRADE_ACCEPTED = "TRADE_ACCEPTED",
  TRADE_REJECTED = "TRADE_REJECTED",
  TRADE_VETOED   = "TRADE_VETOED",
  SYSTEM         = "SYSTEM",
}

export enum TradeStatus {
  PENDING  = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  VETOED   = "VETOED",
}
