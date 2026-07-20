import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import config from "../../config/index.js";

const RACING_API_BASE_URL = "https://api.theracingapi.com/v1";

export const racingApi = axios.create({
  baseURL: RACING_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add basic auth headers interceptor
racingApi.interceptors.request.use((cfg) => {
  const apiKey = config.racing.apiKey || process.env.RACING_API_KEY;
  const apiSecret = config.racing.apiSecret || process.env.RACING_API_SECRET;

  if (apiKey && apiSecret) {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    cfg.headers["Authorization"] = `Basic ${auth}`;
  }
  return cfg;
});

// Helper to construct dynamic date offset strings
const getDateOffsetStr = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

// Response interceptor to handle free tier retries and local file fallbacks
racingApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error.config;
    if (!cfg) return Promise.reject(error);

    const url = cfg.url || "";
    console.warn(`[racingApi] Request to ${url} failed: ${error.message}. Checking fallback...`);

    if (
      url.includes("/racecards") &&
      !url.includes("/free") &&
      error.response &&
      [401, 403, 422].includes(error.response.status)
    ) {
      console.log(`[racingApi] Unauthorized or restricted. Retrying with /racecards/free...`);
      cfg.url = "/racecards/free";
      cfg.params = {}; // clear params to prevent validation errors on free endpoint
      return racingApi(cfg);
    }

    // 2. Local mock file fallbacks for development/offline testing
    try {
      if (url.includes("/racecards")) {
        const racesFilePath = path.join(process.cwd(), "races_today_response.json");
        const detailsFilePath = path.join(process.cwd(), "race_detail_response.json");

        if (fs.existsSync(racesFilePath) && fs.existsSync(detailsFilePath)) {
          console.log("[racingApi] Fallback: Serving mock racecards list from local JSON files");
          const racesData = JSON.parse(fs.readFileSync(racesFilePath, "utf8"));
          const detailsData = JSON.parse(fs.readFileSync(detailsFilePath, "utf8"));

          const rawRaces = racesData.data || [];
          const mockEntries = detailsData.data?.entries || [];

          // Map local old mock data to The Racing API's /v1/racecards format
          const mappedRacecards = rawRaces.slice(0, 10).map((race: any, idx: number) => {
            // Distribute race dates around today: race 0-3 today, 4-6 tomorrow, 7-9 day after
            let dateOffset = 0;
            if (idx >= 7) dateOffset = 2;
            else if (idx >= 4) dateOffset = 1;

            const targetDateStr = getDateOffsetStr(dateOffset);
            const externalId = (race.id ? race.id + dateOffset * 100000 : 33913 + idx).toString();

            // Map old entries to new runners format
            const runners = mockEntries.map((entry: any, eIdx: number) => ({
              horse: entry.horse_name || `Mock Horse ${eIdx}`,
              horse_id: (entry.horse_id || 1000 + eIdx).toString(),
              age: (entry.horse_age || 3).toString(),
              sex: entry.horse_sex || "g",
              sex_code: entry.horse_sex === "f" ? "F" : "G",
              colour: "b",
              region: entry.horse_country || "GB",
              dam: entry.dam || "Mock Dam",
              dam_id: `dam_${eIdx}`,
              sire: entry.sire || "Mock Sire",
              sire_id: `sir_${eIdx}`,
              damsire: entry.dam_sire || "Mock DamSire",
              damsire_id: `dsi_${eIdx}`,
              trainer: entry.trainer_name || "Mock Trainer",
              trainer_id: `trn_${eIdx}`,
              owner: "Mock Owner",
              owner_id: `own_${eIdx}`,
              number: (eIdx + 1).toString(),
              draw: (entry.draw || eIdx + 1).toString(),
              headgear: "",
              lbs: entry.weight || "9-0",
              ofr: "-",
              jockey: entry.jockey_name || "Mock Jockey",
              jockey_id: (entry.jockey_id || 2000 + eIdx).toString(),
              last_run: "15",
              form: "1-2-3",
            }));

            return {
              race_id: externalId,
              course: race.racecourse_name || "Mock Course",
              date: targetDateStr,
              off_time: race.off_time || "12:00",
              off_dt: `${targetDateStr}T${race.off_time || "12:00"}:00Z`,
              race_name: race.race_name || "Mock Stakes",
              distance_f: "6.0",
              region: race.country || "GB",
              pattern: "",
              race_class: "Class 4",
              type: race.race_type || "Flat",
              age_band: race.age_restriction || "3yo+",
              rating_band: "",
              sex_restriction: "",
              prize: "£10,000",
              field_size: runners.length.toString(),
              going: race.going || "Good",
              surface: "Turf",
              runners,
              race_status: dateOffset === 0 ? "live" : "upcoming",
            };
          });

          return {
            data: {
              racecards: mappedRacecards,
              total: mappedRacecards.length,
              limit: 500,
              skip: 0,
              query: [],
            },
            status: 200,
            statusText: "OK",
            headers: {},
            config: cfg,
          };
        }
      }

      if (url.includes("/results")) {
        const racesFilePath = path.join(process.cwd(), "races_today_response.json");
        const detailsFilePath = path.join(process.cwd(), "race_detail_response.json");

        if (fs.existsSync(racesFilePath) && fs.existsSync(detailsFilePath)) {
          console.log("[racingApi] Fallback: Serving mock results from local JSON files");
          const racesData = JSON.parse(fs.readFileSync(racesFilePath, "utf8"));
          const detailsData = JSON.parse(fs.readFileSync(detailsFilePath, "utf8"));

          const rawRaces = racesData.data || [];
          const mockEntries = detailsData.data?.entries || [];

          // Map to results format
          const yesterdayStr = getDateOffsetStr(-1);
          const mappedResults = rawRaces.slice(0, 5).map((race: any, idx: number) => {
            const externalId = (race.id ? race.id + 200000 : 44913 + idx).toString();

            const runners = mockEntries.map((entry: any, eIdx: number) => {
              const position = eIdx + 1;
              return {
                horse: entry.horse_name || `Mock Horse ${eIdx}`,
                horse_id: (entry.horse_id || 1000 + eIdx).toString(),
                age: (entry.horse_age || 3).toString(),
                sex: entry.horse_sex || "g",
                sex_code: entry.horse_sex === "f" ? "F" : "G",
                colour: "b",
                region: entry.horse_country || "GB",
                dam: entry.dam || "Mock Dam",
                dam_id: `dam_${eIdx}`,
                sire: entry.sire || "Mock Sire",
                sire_id: `sir_${eIdx}`,
                damsire: entry.dam_sire || "Mock DamSire",
                damsire_id: `dsi_${eIdx}`,
                trainer: entry.trainer_name || "Mock Trainer",
                trainer_id: `trn_${eIdx}`,
                owner: "Mock Owner",
                owner_id: `own_${eIdx}`,
                number: (eIdx + 1).toString(),
                draw: (entry.draw || eIdx + 1).toString(),
                headgear: "",
                lbs: entry.weight || "9-0",
                ofr: "-",
                jockey: entry.jockey_name || "Mock Jockey",
                jockey_id: (entry.jockey_id || 2000 + eIdx).toString(),
                last_run: "15",
                form: "1-2-3",
                position,
              };
            });

            return {
              race_id: externalId,
              course: race.racecourse_name || "Mock Course",
              date: yesterdayStr,
              off_time: race.off_time || "12:00",
              off_dt: `${yesterdayStr}T${race.off_time || "12:00"}:00Z`,
              race_name: race.race_name || "Mock Finished Stakes",
              distance_f: "6.0",
              region: race.country || "GB",
              pattern: "",
              race_class: "Class 4",
              type: race.race_type || "Flat",
              age_band: race.age_restriction || "3yo+",
              rating_band: "",
              sex_restriction: "",
              prize: "£10,000",
              field_size: runners.length.toString(),
              going: race.going || "Good",
              surface: "Turf",
              runners,
              race_status: "finished",
            };
          });

          return {
            data: {
              results: mappedResults,
              total: mappedResults.length,
              limit: 500,
              skip: 0,
              query: [],
            },
            status: 200,
            statusText: "OK",
            headers: {},
            config: cfg,
          };
        }
      }
    } catch (fallbackError: any) {
      console.error("[racingApi] Fallback processing failed:", fallbackError.message);
    }

    return Promise.reject(error);
  }
);
