import axios, { AxiosInstance, AxiosError } from "axios";
import config from "../config/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// RacingApiGateway
//
// Single responsibility: all communication with The Racing API.
// Implements the Pro Plan endpoints for Goldentak Server.
//
// Rules:
//  1. Never called from API Controllers or HTTP request handlers.
//  2. Only called from BullMQ workers / sync services.
//  3. Racing API credentials never exposed beyond this file.
//  4. All responses normalised before returning.
// ─────────────────────────────────────────────────────────────────────────────

const RACING_API_BASE_URL = "https://api.theracingapi.com/v1";
const DEFAULT_TIMEOUT_MS  = 12_000;
const MAX_RETRIES          = 3;
const INITIAL_RETRY_DELAY  = 1_000;

function buildAuthHeader(): string {
  const apiKey    = config.racing.apiKey;
  const apiSecret = config.racing.apiSecret;
  if (!apiKey || !apiSecret) {
    throw new Error("[RacingApiGateway] Racing API credentials not configured.");
  }
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

function retryDelay(attempt: number, jitter = true): number {
  const base = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return jitter ? base + Math.random() * 500 : base;
}

function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // Network error — always retry
  return [429, 503, 504].includes(error.response.status);
}

class RacingApiGateway {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: RACING_API_BASE_URL,
      timeout: DEFAULT_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });

    // Inject auth header on every request
    this.client.interceptors.request.use((cfg) => {
      cfg.headers["Authorization"] = buildAuthHeader();
      return cfg;
    });
  }

  private async request<T>(
    method: "get" | "post",
    url: string,
    params?: Record<string, any>
  ): Promise<T> {
    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.request<T>({
          method,
          url,
          params,
        });
        return response.data;
      } catch (err: any) {
        const axiosErr = err as AxiosError;
        lastError = axiosErr;

        // 401/403/422 → free tier fallback on racecards
        if (
          url.includes("/racecards") &&
          !url.includes("/free") &&
          axiosErr.response &&
          [401, 403, 422].includes(axiosErr.response.status)
        ) {
          console.warn(`[RacingApiGateway] Auth failed for ${url}. Falling back to /racecards/free`);
          try {
            const fallback = await this.client.get<T>("/racecards/free");
            return fallback.data;
          } catch {
            // Free tier also failed — fall through to retry logic
          }
        }

        if (!isRetryable(axiosErr)) break;

        // 429 — respect Retry-After header or response body retry_after (default 30s)
        if (axiosErr.response?.status === 429) {
          const bodyRetry = (axiosErr.response.data as any)?.retry_after;
          const headerRetry = (axiosErr.response.headers as any)["retry-after"];
          const retryAfter = parseInt(bodyRetry ?? headerRetry ?? "30", 10) || 30;
          console.warn(`[RacingApiGateway] Rate limited (429). Waiting ${retryAfter}s before retrying...`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = retryDelay(attempt);
          console.warn(
            `[RacingApiGateway] ${url} failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${axiosErr.message}. Retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    const status  = lastError?.response?.status ?? 0;
    const message = lastError?.message ?? "Unknown error";
    console.error(`[RacingApiGateway] All retries exhausted for ${url}: ${status} ${message}`);
    throw lastError ?? new Error(`Request to ${url} failed after ${MAX_RETRIES} attempts`);
  }

  // ── 1. RACECARDS & RESULTS (Multi-Region Support) ──────────────────────────

  async fetchRacecards(date?: string, region = "gb"): Promise<any> {
    const params: any = { region };
    if (date) params.date = date;
    return this.request("get", "/racecards/pro", params);
  }

  async fetchRacecardsForDate(date: string, region = "gb"): Promise<any> {
    return this.request("get", "/racecards/pro", { date, region });
  }

  async fetchResults(date?: string, region = "gb"): Promise<any> {
    const params: any = { region };
    if (date) params.date = date;
    return this.request("get", "/results", params);
  }

  async fetchSingleRacecard(raceId: string): Promise<any> {
    return this.request("get", `/racecards/${raceId}/pro`);
  }

  // ── 2. HORSES (Pro Plan Profile, Career Results, Distance Analysis) ────────

  async searchHorse(name: string): Promise<any> {
    return this.request("get", "/horses/search", { name });
  }

  async fetchHorseProProfile(horseId: string): Promise<any> {
    return this.request("get", `/horses/${horseId}/pro`);
  }

  async fetchHorseResults(horseId: string, limit = 50, skip = 0): Promise<any> {
    return this.request("get", `/horses/${horseId}/results`, { limit, skip });
  }

  async fetchHorseDistanceTimesAnalysis(horseId: string): Promise<any> {
    return this.request("get", `/horses/${horseId}/analysis/distance-times`);
  }

  // ── 3. JOCKEYS (Results and course/distance/trainer/owner analysis) ────────

  async searchJockey(name: string): Promise<any> {
    return this.request("get", "/jockeys/search", { name });
  }

  async fetchJockeyResults(jockeyId: string, limit = 50, skip = 0): Promise<any> {
    return this.request("get", `/jockeys/${jockeyId}/results`, { limit, skip });
  }

  async fetchJockeyCourseAnalysis(jockeyId: string): Promise<any> {
    return this.request("get", `/jockeys/${jockeyId}/analysis/courses`);
  }

  async fetchJockeyDistanceAnalysis(jockeyId: string): Promise<any> {
    return this.request("get", `/jockeys/${jockeyId}/analysis/distances`);
  }

  async fetchJockeyTrainerAnalysis(jockeyId: string): Promise<any> {
    return this.request("get", `/jockeys/${jockeyId}/analysis/trainers`);
  }

  async fetchJockeyOwnerAnalysis(jockeyId: string): Promise<any> {
    return this.request("get", `/jockeys/${jockeyId}/analysis/owners`);
  }

  // ── 4. TRAINERS (Results and course/distance/jockey/owner analysis) ────────

  async searchTrainer(name: string): Promise<any> {
    return this.request("get", "/trainers/search", { name });
  }

  async fetchTrainerResults(trainerId: string, limit = 50, skip = 0): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/results`, { limit, skip });
  }

  async fetchTrainerCourseAnalysis(trainerId: string): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/analysis/courses`);
  }

  async fetchTrainerDistanceAnalysis(trainerId: string): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/analysis/distances`);
  }

  async fetchTrainerJockeyAnalysis(trainerId: string): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/analysis/jockeys`);
  }

  async fetchTrainerOwnerAnalysis(trainerId: string): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/analysis/owners`);
  }

  async fetchTrainerHorseAgeAnalysis(trainerId: string): Promise<any> {
    return this.request("get", `/trainers/${trainerId}/analysis/horse-age`);
  }

  // ── 5. SIRES & DAMS & DAMSIRES (Pedigree Offspring Performance) ───────────

  async searchSire(name: string): Promise<any> {
    return this.request("get", "/sires/search", { name });
  }

  async fetchSireResults(sireId: string, limit = 100): Promise<any> {
    return this.request("get", `/sires/${sireId}/results`, { limit });
  }

  async fetchSireDistanceAnalysis(sireId: string): Promise<any> {
    return this.request("get", `/sires/${sireId}/analysis/distances`);
  }

  async fetchSireClassAnalysis(sireId: string): Promise<any> {
    return this.request("get", `/sires/${sireId}/analysis/classes`);
  }

  async searchDam(name: string): Promise<any> {
    return this.request("get", "/dams/search", { name });
  }

  async fetchDamResults(damId: string, limit = 100): Promise<any> {
    return this.request("get", `/dams/${damId}/results`, { limit });
  }

  async fetchDamDistanceAnalysis(damId: string): Promise<any> {
    return this.request("get", `/dams/${damId}/analysis/distances`);
  }

  async fetchDamClassAnalysis(damId: string): Promise<any> {
    return this.request("get", `/dams/${damId}/analysis/classes`);
  }

  async searchDamSire(name: string): Promise<any> {
    return this.request("get", "/damsires/search", { name });
  }

  async fetchDamSireResults(damSireId: string, limit = 100): Promise<any> {
    return this.request("get", `/damsires/${damSireId}/results`, { limit });
  }

  async fetchDamSireDistanceAnalysis(damSireId: string): Promise<any> {
    return this.request("get", `/damsires/${damSireId}/analysis/distances`);
  }

  async fetchDamSireClassAnalysis(damSireId: string): Promise<any> {
    return this.request("get", `/damsires/${damSireId}/analysis/classes`);
  }

  // ── 6. ODDS ────────────────────────────────────────────────────────────────

  async fetchOdds(raceId: string, horseId?: string): Promise<any> {
    const url = horseId ? `/odds/${raceId}/${horseId}` : `/odds/${raceId}`;
    return this.request("get", url);
  }
}

// Singleton — one client instance, one rate-limit state
export const racingApiGateway = new RacingApiGateway();
