import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const RACING_API_BASE_URL = "https://api.theracingapi.com/v1";
const apiKey = process.env.RACING_API_KEY;
const apiSecret = process.env.RACING_API_SECRET;

async function testApi() {
  console.log("Testing Racing API with Basic Auth...");
  try {
    const response = await axios.get(`${RACING_API_BASE_URL}/racecards`, {
      auth: {
        username: apiKey as string,
        password: apiSecret as string
      }
    });
    console.log("Success! Status:", response.status);
    console.log("Data sample:", JSON.stringify(response.data).substring(0, 200));
  } catch (error: any) {
    console.error("Error:", error.response?.status, error.response?.data || error.message);
  }
}

testApi();
