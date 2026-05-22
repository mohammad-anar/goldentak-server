import axios from 'axios';
import * as fs from 'fs';

async function testApi() {
  const apiKey = '8408f5322emshbe7853e9cdc6bfap197446jsn9e54f45e8f05';
  const apiHost = 'ai-horse-racing-predictions.p.rapidapi.com';
  
  console.log("Testing /predictions/race/33582...");
  try {
    const response = await axios.get('https://ai-horse-racing-predictions.p.rapidapi.com/predictions/race/33582', {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      }
    });
    console.log("Status predictions/race/33582:", response.status);
    console.log("Response type:", typeof response.data);
    fs.writeFileSync('predictions_race_no_pred.json', JSON.stringify(response.data, null, 2));
    console.log("Saved response to predictions_race_no_pred.json");
    console.log("Response sample:", JSON.stringify(response.data, null, 2).substring(0, 1000));
  } catch (error: any) {
    console.error("Error fetching /predictions/race/33582:", error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.error("Error data:", error.response.data);
    }
  }

  console.log("\nTesting /races/33913...");
  try {
    const response = await axios.get('https://ai-horse-racing-predictions.p.rapidapi.com/races/33913', {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      }
    });
    console.log("Status /races/33913:", response.status);
    fs.writeFileSync('race_detail_response.json', JSON.stringify(response.data, null, 2));
    console.log("Saved response to race_detail_response.json");
    console.log("Response sample:", JSON.stringify(response.data, null, 2).substring(0, 1000));
  } catch (error: any) {
    console.error("Error fetching /races/33913:", error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.error("Error data:", error.response.data);
    }
  }
}

testApi();
