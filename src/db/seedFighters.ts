import { prisma } from "../helpers/prisma.js";

const divisions = [
  "Flyweight",
  "Bantamweight",
  "Featherweight",
  "Lightweight",
  "Welterweight",
  "Middleweight",
  "Light Heavyweight",
  "Heavyweight",
  "Women's Strawweight",
  "Women's Flyweight",
  "Women's Bantamweight",
];

const firstNames = [
  "Jon", "Conor", "Israel", "Khabib", "Dustin", "Justin", "Max", "Alexander", "Kamaru", "Jorge",
  "Charles", "Islam", "Leon", "Alex", "Robert", "Sean", "Aljamain", "Brandon", "Deiveson", "Amanda",
  "Valentina", "Rose", "Joanna", "Zhang", "Holly", "Julianna", "Glover", "Jan", "Jiri", "Magomed",
  "Gilbert", "Colby", "Belal", "Shavkat", "Khamzat", "Bo", "Paddy", "Ilir", "Tai", "Tom",
  "Ciryl", "Sergei", "Curtis", "Stipe", "Francis", "Derrick", "Jailton", "Roman", "Merab", "Cory"
];

const lastNames = [
  "Jones", "McGregor", "Adesanya", "Nurmagomedov", "Poirier", "Gaethje", "Holloway", "Volkanovski", "Usman", "Masvidal",
  "Oliveira", "Makhachev", "Edwards", "Pereira", "Whittaker", "O'Malley", "Sterling", "Moreno", "Figueiredo", "Nunes",
  "Shevchenko", "Namajunas", "Jedrzejczyk", "Weili", "Holm", "Peña", "Teixeira", "Blachowicz", "Prochazka", "Ankalaev",
  "Burns", "Covington", "Muhammad", "Rakhmonov", "Chimaev", "Nickal", "Pimblett", "Latifi", "Tuivasa", "Aspinall",
  "Gane", "Pavlovich", "Blaydes", "Miocic", "Ngannou", "Lewis", "Almeida", "Dolidze", "Dvalishvili", "Sandhagen"
];

const nationalities = ["USA", "Brazil", "Russia", "Nigeria", "Australia", "New Zealand", "Ireland", "Poland", "China", "Mexico", "Georgia", "UK", "France", "Cameroon", "Canada"];

export const seedFighters = async () => {
  try {
    const fighterCount = await prisma.fighter.count();

    if (fighterCount > 0) {
      console.log("🥊 Fighters already exist in database. Skipping seed.");
      return;
    }

    console.log("🌱 Fighter table is empty. Starting seed of 50 fighters...");

    // 1. Create/Ensure Divisions exist
    const divisionMap: Record<string, string> = {};
    for (const name of divisions) {
      const division = await prisma.division.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      divisionMap[name] = division.id;
    }
    console.log(`✅ Verified ${Object.keys(divisionMap).length} divisions.`);

    // 2. Generate and Create 50 Fighters
    const fighterPromises = [];
    for (let i = 0; i < 50; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${firstName} ${lastName}`;
      const divisionName = divisions[Math.floor(Math.random() * divisions.length)];
      const divisionId = divisionMap[divisionName];

      fighterPromises.push(
        prisma.fighter.create({
          data: {
            name,
            nickname: i % 3 === 0 ? "The Predator" : i % 5 === 0 ? "The Great" : "",
            nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
            divisionId,
            rank: (i % 15) + 1,
            wins: Math.floor(Math.random() * 30) + 5,
            losses: Math.floor(Math.random() * 10),
            draws: Math.floor(Math.random() * 2),
            avgL5: Math.floor(Math.random() * 100),
            isActive: true,
            age: Math.floor(Math.random() * 15) + 20,
            height: `${Math.floor(Math.random() * 30) + 160} cm`,
            bio: `Professional fighter in the ${divisionName} division.`,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s/g, "")}`,
          },
        })
      );
    }

    await Promise.all(fighterPromises);
    console.log("✨ Successfully seeded 50 fighters.");
  } catch (error) {
    console.error("❌ Error seeding fighters:", error);
  }
};
