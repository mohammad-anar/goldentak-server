import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const RAPID_API_BASE_URL = "https://ai-horse-racing-predictions.p.rapidapi.com";

export const rapidApi = axios.create({
  baseURL: RAPID_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptors to inject RapidAPI headers
rapidApi.interceptors.request.use((config) => {
  const apiKey = process.env.RAPID_API_SECRET_KEY;
  const apiHost = "ai-horse-racing-predictions.p.rapidapi.com";

  if (apiKey) {
    config.headers["X-RapidAPI-Key"] = apiKey;
    config.headers["X-RapidAPI-Host"] = apiHost;
  }
  return config;
});

// Add response interceptor to handle errors by falling back to local cached files
rapidApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    console.warn(`[rapidApi] Request to ${config.url} failed: ${error.message}. Checking local fallback...`);
    
    try {
      const url = config.url || "";
      if (url.includes("/races/today")) {
        const filePath = path.join(process.cwd(), "races_today_response.json");
        if (fs.existsSync(filePath)) {
          console.log("[rapidApi] Serving fallback from races_today_response.json");
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          return { data, status: 200, statusText: "OK", headers: {}, config };
        }
      }
      
      if (url.includes("/races/")) {
        const id = url.split("/races/")[1];
        const filePath = path.join(process.cwd(), "race_detail_response.json");
        if (fs.existsSync(filePath)) {
          console.log(`[rapidApi] Serving fallback from race_detail_response.json for ID ${id}`);
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (data.data && id) {
            data.data.id = parseInt(id, 10) || id;
          }
          return { data, status: 200, statusText: "OK", headers: {}, config };
        }
      }
      
      if (url.includes("/predictions/race/")) {
        const id = url.split("/predictions/race/")[1];
        const filePath = path.join(process.cwd(), "predictions_race_response.json");
        if (fs.existsSync(filePath)) {
          console.log(`[rapidApi] Serving fallback from predictions_race_response.json for ID ${id}`);
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (data.race && id) {
            data.race.id = parseInt(id, 10) || id;
          }
          return { data, status: 200, statusText: "OK", headers: {}, config };
        }
      }
    } catch (fallbackError: any) {
      console.error("[rapidApi] Fallback failed:", fallbackError.message);
    }
    
    return Promise.reject(error);
  }
);

