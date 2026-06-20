import { PrismaClient, RaceStatus, Category } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up existing database data...");
  await prisma.raceResult.deleteMany();
  await prisma.raceEntry.deleteMany();
  await prisma.race.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.jockey.deleteMany();
  console.log("Cleanup complete.");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 1. Create Jockeys
  const jockeyData = [
    { name: "C. Demuro", externalId: "j-1" },
    { name: "M. Barzalona", externalId: "j-2" },
    { name: "L. Boisseau", externalId: "j-3" },
    { name: "A. Can", externalId: "j-4" },
    { name: "H. Karatas", externalId: "j-5" },
    { name: "S. Kaya", externalId: "j-6" },
    { name: "G. Kocakaya", externalId: "j-7" },
    { name: "A. Kurşun", externalId: "j-8" },
    { name: "L. Gallo", externalId: "j-9" },
    { name: "M. Favriaux", externalId: "j-10" },
    { name: "T. Piccone", externalId: "j-11" },
    { name: "Eddy Hardouin", externalId: "j-12" },
  ];

  const jockeys = [];
  for (const j of jockeyData) {
    const created = await prisma.jockey.create({
      data: {
        name: j.name,
        externalId: j.externalId,
        wins: Math.floor(Math.random() * 40) + 10,
        seconds: Math.floor(Math.random() * 30) + 5,
        thirds: Math.floor(Math.random() * 20) + 5,
        fourths: Math.floor(Math.random() * 15) + 2,
        totalRides: Math.floor(Math.random() * 200) + 100,
        winsLast30d: Math.floor(Math.random() * 10) + 2,
        ridesLast30d: Math.floor(Math.random() * 40) + 15,
      },
    });
    jockeys.push(created);
  }
  console.log(`Seeded ${jockeys.length} jockeys.`);

  // 2. Create Horses
  const horseData = [
    { name: "Thunder Bolt", country: "GB" },
    { name: "Lightning Star", country: "GB" },
    { name: "Storm Runner", country: "GB" },
    { name: "Golden Eagle", country: "FR" },
    { name: "Silver Arrow", country: "FR" },
    { name: "Belisa Bay", country: "GB" },
    { name: "Mr Say", country: "GB" },
    { name: "Maitre Jimmy", country: "FR" },
    { name: "Body Physical", country: "GB" },
    { name: "Lady Osprey", country: "FR" },
    { name: "Partie Rocket", country: "GB" },
    { name: "Taxxi", country: "GB" },
    { name: "Off Spring", country: "FR" },
    { name: "Enfant Paradis", country: "FR" },
    { name: "Ninao", country: "GB" },
    { name: "Aksi Seda", country: "TR" },
    { name: "Venom", country: "TR" },
    { name: "Blue Fire", country: "TR" },
  ];

  const horses = [];
  for (const h of horseData) {
    const wins = Math.floor(Math.random() * 15) + 3;
    const totalRaces = wins + Math.floor(Math.random() * 20) + 5;
    const created = await prisma.horse.create({
      data: {
        name: h.name,
        country: h.country,
        externalId: `h-${h.name.toLowerCase().replace(/ /g, "-")}`,
        age: Math.floor(Math.random() * 4) + 2,
        color: ["Bay", "Chestnut", "Grey", "Brown"][Math.floor(Math.random() * 4)],
        sex: ["c", "f", "g"][Math.floor(Math.random() * 3)],
        sireName: "Northern Dancer",
        damName: "Sea Breeze",
        owner: "Premium Racing Stables",
        trainer: "M. Dixon",
        totalEarnings: wins * 45000 + Math.floor(Math.random() * 100000),
        bestTime: `1:${Math.floor(Math.random() * 5) + 10}.${Math.floor(Math.random() * 90) + 10}`,
        bestTimeLocation: "Longchamp",
        totalRaces,
        wins,
        seconds: Math.floor(Math.random() * 5) + 1,
        thirds: Math.floor(Math.random() * 4) + 1,
        fourths: Math.floor(Math.random() * 3) + 1,
      },
    });
    horses.push(created);
  }
  console.log(`Seeded ${horses.length} horses.`);

  // 3. Create Races
  const raceMeetings = [
    {
      location: "Ascot",
      country: "United Kingdom",
      trackType: "Turf",
      distance: "1m 2f",
      time: "13:30",
      status: RaceStatus.UPCOMING,
      name: "Prince of Wales Stakes",
    },
    {
      location: "Ascot",
      country: "United Kingdom",
      trackType: "Turf",
      distance: "6f",
      time: "14:15",
      status: RaceStatus.UPCOMING,
      name: "Royal Jubilee Stakes",
    },
    {
      location: "Ascot",
      country: "United Kingdom",
      trackType: "Turf",
      distance: "1m",
      time: "15:00",
      status: RaceStatus.LIVE,
      name: "Queen Anne Stakes",
    },
    {
      location: "Longchamp",
      country: "France",
      trackType: "Turf",
      distance: "1m 4f",
      time: "15:45",
      status: RaceStatus.UPCOMING,
      name: "Prix de l'Arc de Triomphe",
    },
    {
      location: "Longchamp",
      country: "France",
      trackType: "Turf",
      distance: "7f",
      time: "16:30",
      status: RaceStatus.FINISHED,
      name: "Prix de la Foret",
    },
    {
      location: "Gulfstream Park",
      country: "United States",
      trackType: "Sand",
      distance: "1m 1f",
      time: "17:15",
      status: RaceStatus.UPCOMING,
      name: "Pegasus World Cup",
    },
    {
      location: "Gulfstream Park",
      country: "United States",
      trackType: "Sand",
      distance: "6f",
      time: "18:00",
      status: RaceStatus.FINISHED,
      name: "Gulfstream Sprint",
    },
    {
      location: "Turffontein",
      country: "South Africa",
      trackType: "Turf",
      distance: "1m",
      time: "18:45",
      status: RaceStatus.FINISHED,
      name: "Summer Cup",
    },
    {
      location: "Istanbul",
      country: "Turkey",
      trackType: "Sand",
      distance: "1600m",
      time: "19:30",
      status: RaceStatus.FINISHED,
      name: "Gazi Derby Preview",
    },
    {
      location: "Ankara",
      country: "Turkey",
      trackType: "Turf",
      distance: "2000m",
      time: "20:15",
      status: RaceStatus.FINISHED,
      name: "Ankara Stakes",
    },
  ];

  for (let idx = 0; idx < raceMeetings.length; idx++) {
    const m = raceMeetings[idx];
    const externalId = (33900 + idx).toString();
    
    // Choose 8 horses for this race
    const raceHorses = [...horses].sort(() => 0.5 - Math.random()).slice(0, 8);
    
    const confidence = ["HIGH", "MEDIUM", "LOW"][idx % 3];
    let tahmin1X = "1X";
    let riskRate = 65;
    if (confidence === "HIGH") {
      tahmin1X = "1";
      riskRate = 85;
    } else if (confidence === "LOW") {
      tahmin1X = "12";
      riskRate = 45;
    }

    const firstHorseName = raceHorses[0].name;
    const predictionMessage = `${firstHorseName} displays dominant metrics on today's ${m.trackType} track. Strong past speed rating makes this selection the premium AI Choice.`;

    const race = await prisma.race.create({
      data: {
        externalId,
        name: m.name,
        date: today,
        time: m.time,
        location: m.location,
        country: m.country,
        trackType: m.trackType,
        distance: m.distance,
        prize: "25000",
        status: m.status,
        tahmin1X,
        riskRate,
        predictionMessage,
        hasPredictions: true,
      },
    });

    // Seed entries
    for (let hIdx = 0; hIdx < raceHorses.length; hIdx++) {
      const horse = raceHorses[hIdx];
      const jockey = jockeys[hIdx % jockeys.length];
      const rank = hIdx + 1;

      // Rating score out of 100 based on rank
      let ratingScore = 30;
      if (hIdx === 0) ratingScore = 98;
      else if (hIdx === 1) ratingScore = 90;
      else if (hIdx === 2) ratingScore = 82;
      else if (hIdx === 3) ratingScore = 75;
      else if (hIdx === 4) ratingScore = 68;
      else if (hIdx === 5) ratingScore = 60;
      else if (hIdx === 6) ratingScore = 52;
      else ratingScore = 44;

      const winProb = hIdx === 0 ? 0.32 : hIdx === 1 ? 0.22 : hIdx === 2 ? 0.15 : 0.05;

      const entry = await prisma.raceEntry.create({
        data: {
          raceId: race.id,
          horseId: horse.id,
          jockeyId: jockey.id,
          jockeyName: jockey.name,
          weight: 120 + hIdx * 2,
          draw: hIdx + 1,
          horsePower: 2.2 - hIdx * 0.2,
          jockeyPower: 2.4 - hIdx * 0.2,
          normalizedScore: ratingScore,
          rank: rank,
          category: hIdx < 3 ? Category.BIG : hIdx < 6 ? Category.MEDIUM : Category.SMALL,
          winProb,
          winOddsFair: Number((1.0 / winProb).toFixed(2)),
          placeProb: winProb * 2.1,
          goingSuitabilityScore: 0.9 - hIdx * 0.1,
          distanceSuitabilityScore: 0.85 - hIdx * 0.05,
          jockeyFormScore: 0.78 - hIdx * 0.06,
          trainerFormScore: 0.8 - hIdx * 0.05,
          aiSelectionRank: rank,
          aiConfidence: hIdx === 0 ? confidence : hIdx === 1 ? "MEDIUM" : "LOW",
          aiConfidenceScore: hIdx === 0 ? 0.85 : 0.50,
          aiAnalysis: `${horse.name} is showing excellent preparation. Pre-race stats highlight optimal conditions for today's race.`,
        },
      });

      // If race is finished, create results
      if (m.status === RaceStatus.FINISHED) {
        let earnings = 0;
        if (rank === 1) earnings = 15000;
        else if (rank === 2) earnings = 5000;
        else if (rank === 3) earnings = 3000;
        else if (rank === 4) earnings = 2000;

        await prisma.raceResult.create({
          data: {
            raceId: race.id,
            horseId: horse.id,
            jockeyId: jockey.id,
            position: rank,
            time: `1:4${hIdx}.${hIdx * 4 + 10}`,
            earnings,
          },
        });
      }
    }
  }

  console.log("Seeding complete. Seeding high-fidelity database done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
