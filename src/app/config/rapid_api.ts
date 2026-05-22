import axios from "axios";

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
