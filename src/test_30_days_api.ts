import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main() {
  const apiKey = process.env.RAPID_API_SECRET_KEY;
  const apiHost = "ai-horse-racing-predictions.p.rapidapi.com";

  try {
    const url = `https://ai-horse-racing-predictions.p.rapidapi.com/races/results?days=30`;
    console.log(`Sending GET request to: ${url} (15s timeout)...`);
    const response = await axios.get(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": apiHost,
      },
      timeout: 15000,
    });
    console.log("Success! Status:", response.status);
    const data = response.data?.data || [];
    console.log("Total races returned:", data.length);
    if (data.length > 0) {
      console.log("Sample race:", JSON.stringify(data[0]).substring(0, 300));
    }
  } catch (error: any) {
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

main();
