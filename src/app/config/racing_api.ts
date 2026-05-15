import axios from "axios";

const RACING_API_BASE_URL = "https://api.theracingapi.com/v1";

export const racingApi = axios.create({
  baseURL: RACING_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptors for Basic Authentication
racingApi.interceptors.request.use((config) => {
  const apiKey = process.env.RACING_API_KEY;
  const apiSecret = process.env.RACING_API_SECRET;

  if (apiKey && apiSecret) {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    config.headers.Authorization = `Basic ${auth}`;
  }
  return config;
});
