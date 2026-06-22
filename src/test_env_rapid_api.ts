import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function testConfiguredApi() {
  const apiKey = process.env.RAPID_API_SECRET_KEY;
  const apiHost = "ai-horse-racing-predictions.p.rapidapi.com";

  console.log("Using API Key from .env:", apiKey ? `${apiKey.substring(0, 8)}...` : "UNDEFINED");
  if (!apiKey) {
    console.error("❌ RAPID_API_SECRET_KEY is not defined in your .env file!");
    return;
  }

  const endpoints = [
    "/races/upcoming?days=3",
    "/races/results?days=3",
    "/predictions/upcoming?days=3"
  ];

  for (const endpoint of endpoints) {
    try {
      const url = `https://ai-horse-racing-predictions.p.rapidapi.com${endpoint}`;
      console.log(`\n--------------------------------------------`);
      console.log(`Sending GET request to: ${url}...`);
      const response = await axios.get(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": apiHost,
        },
        timeout: 10000,
      });
      console.log(`✅ Success for ${endpoint}! Response status:`, response.status);
      const data = response.data;
      const count = data.data ? data.data.length : data.races ? data.races.length : "N/A";
      console.log("Data count/keys:", count);
    } catch (error: any) {
      console.error(`❌ Request to ${endpoint} failed!`);
      if (error.response) {
        console.error("Response Status:", error.response.status);
        console.error("Response Data:", error.response.data);
      } else {
        console.error("Error Message:", error.message);
      }
    }
  }
}

testConfiguredApi();
