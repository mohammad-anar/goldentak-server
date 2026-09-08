import bcrypt from "bcryptjs";
import config from "../config/index.js";
import { prisma } from "../helpers/prisma.js";
import { Role } from "../types/enum.js";

export const DEFAULT_ALGORITHM_SETTINGS = [
  {
    key: "WEIGHT_HORSE",
    value: 45,
    label: "Horse Power Weight",
    category: "horse",
    description: "Multiplier for horsePower component (wins*4 + 2nds*3 + 3rds*2 + 4ths*1) / totalRaces",
    minValue: 0,
    maxValue: 100,
  },
  {
    key: "WEIGHT_JOCKEY",
    value: 35,
    label: "Jockey Power Weight",
    category: "jockey",
    description: "Multiplier for jockeyPower component",
    minValue: 0,
    maxValue: 100,
  },
  {
    key: "WEIGHT_SIRE",
    value: 8,
    label: "Sire Power Weight",
    category: "sire",
    description: "Multiplier for sirePower (sire offspring stats)",
    minValue: 0,
    maxValue: 50,
  },
  {
    key: "WEIGHT_DAM",
    value: 6,
    label: "Dam Power Weight",
    category: "dam",
    description: "Multiplier for damPower (dam progeny stats)",
    minValue: 0,
    maxValue: 50,
  },
  {
    key: "WEIGHT_DAMSIRE",
    value: 2,
    label: "Dam Sire Power Weight",
    category: "damsire",
    description: "Multiplier for damSirePower (maternal grandsire)",
    minValue: 0,
    maxValue: 20,
  },
  {
    key: "WEIGHT_PEDIGREE",
    value: 5,
    label: "Pedigree Average Weight",
    category: "pedigree",
    description: "Multiplier for avg(sire, dam, damSire) pedigree power",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "WEIGHT_EARNING",
    value: 5,
    label: "Earning Power Weight",
    category: "earning",
    description: "Multiplier for earningPower = (horseAvgEarning / fieldAvg) - 1",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "WEIGHT_WEIGHT",
    value: 10,
    label: "Weight Effect Multiplier",
    category: "weight",
    description: "Multiplier for weightEffect = (avgFieldWeight - horseWeight) / avgFieldWeight",
    minValue: 0,
    maxValue: 30,
  },
  {
    key: "THRESH_MINIMUM",
    value: 10,
    label: "MINIMUM Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 10 -> MINIMUM (MİNİMUM)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_SMALL",
    value: 20,
    label: "SMALL Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 20 -> SMALL (KÜÇÜK)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_MEDIUM",
    value: 35,
    label: "MEDIUM Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 35 -> MEDIUM (ORTA)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_LARGE",
    value: 50,
    label: "LARGE Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 50 -> LARGE (BÜYÜK)",
    minValue: 0,
    maxValue: 200,
  },
  {
    key: "THRESH_MEGA",
    value: 70,
    label: "MEGA Category Threshold",
    category: "threshold",
    description: "Diff from top score <= 70 -> MEGA (MEGA)",
    minValue: 0,
    maxValue: 200,
  },
];

export async function seedSuperAdmin() {
  const adminEmail = config.admin.email || "admin@gmail.com";
  const adminPassword = config.admin.password || "12345678";
  const adminName = config.admin.name || "Admin";
  const adminPhone = config.admin.phone || "0000000000";
  const adminAvatar =
    config.admin.avatar ||
    "https://i.ibb.co/VWkMFBWM/pngtree-user-icon-png-image-1796659.jpg";

  console.log(`[Seed] Checking Super Admin (${adminEmail})...`);

  const isExist = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { username: "admin" }],
    },
  });

  if (!isExist) {
    const passwordHash = await bcrypt.hash(
      adminPassword,
      config.bcrypt_salt_round || 10
    );

    await prisma.user.create({
      data: {
        name: adminName,
        username: "admin",
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        avatarUrl: adminAvatar,
        role: Role.ADMIN,
        isVerified: true,
      },
    });

    console.log("[Seed] ✅ Super admin seeded successfully.");
  } else {
    console.log("[Seed] ℹ️ Super admin already exists.");
  }
}

export async function seedAlgorithmSettings() {
  console.log("[Seed] Seeding algorithm settings...");

  for (const s of DEFAULT_ALGORITHM_SETTINGS) {
    await prisma.algorithmSetting.upsert({
      where: { key: s.key },
      update: {
        label: s.label,
        description: s.description,
        category: s.category,
        minValue: s.minValue,
        maxValue: s.maxValue,
      },
      create: s,
    });
  }

  console.log(`[Seed] ✅ Seeded ${DEFAULT_ALGORITHM_SETTINGS.length} algorithm settings.`);
}

const trTerms = `<h2>KULLANIM KOŞULLARI VE YASAL UYARI</h2>
<p><strong>Son Güncelleme Tarihi:</strong> 3 Eylül 2026</p>
<p>İşbu Kullanım Koşulları ("Koşullar"), <strong>Which Win Horse Race Analiz Programı</strong> ("Program") tarafından sunulan dijital hizmetlerin kullanımına ilişkin usul ve esasları düzenlemektedir. Program’ı indirerek, yükleyerek veya herhangi bir şekilde kullanarak, işbu koşulları eksiksiz olarak kabul etmiş sayıldığınızı beyan edersiniz.</p>
<h3>1. Taraflar ve Kapsam</h3>
<p>İşbu metin, Which Win Horse Race Analiz Programı (bundan sonra "Hizmet Sağlayıcı" olarak anılacaktır) ile Program’ı mobil cihazlarda veya dijital mecralarda kullanan son kullanıcı ("Kullanıcı") arasındaki yasal çerçeveyi belirler.</p>
<h3>2. Hizmetin Niteliği ve Sorumluluk Sınırlandırması</h3>
<p>• Which Win Horse Race Analiz Programı, at yarışlarına yönelik istatistiksel verileri, geçmiş performansları, dereceleri ve analitik öngörüleri sunan münhasıran bir bilgi, analiz ve veri programıdır.</p>
<p>• <strong>Program kesinlikle bir bahis, şans oyunu veya kumar sitesi veya organizatörü değildir; Which Win Horse Race hiçbir surette bahis oynatmaz, kupon kabul etmez veya aracılık hizmeti sunmaz.</strong></p>
<p>• Sunulan tüm veriler ve analizler yalnızca istatistiksel bilgi ve değerlendirme amaçlıdır. Kullanıcıların program verilerine dayanarak gerçekleştirecekleri her türlü işlem, tercih ve faaliyetten doğabilecek doğrudan veya dolaylı maddi ve manevi zararlardan Which Win Horse Race programı ve geliştiricileri hiçbir şekilde sorumlu tutulamaz.</p>
<h3>3. Fikri Mülkiyet Hakları</h3>
<p>• Program’ın arayüzü, yazılım kodları, logoları, veritabanı yapıları, grafik tasarımları ve metin içerikleri <strong>Which Win</strong> markasına aittir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile ilgili uluslararası fikri mülkiyet mevzuatı kapsamında korunmaktadır.</p>
<p>• Kullanıcı, Program içeriğini yazılı izin olmaksızın kopyalayamaz, çoğaltamaz, ticari amaçla üçüncü kişilere aktaramaz veya tersine mühendislik işlemlerine tabi tutamaz.</p>
<h3>4. Kullanıcı Sorumlulukları</h3>
<p>• Kullanıcı, Program’ı yürürlükteki ulusal ve uluslararası mevzuata, dürüstlük kuralına ve genel ahlaka uygun olarak kullanmakla yükümlüdür.</p>
<p>• 18 yaşından küçüklerin at yarışı ve ilgili analiz içeriklerine erişimi yasaktır. Kullanıcı, yasal yaş sınırını sağladığını beyan ve taahhüt eder.</p>
<p>• Program üzerinden elde edilen verilerin yanlış veya hukuka aykırı amaçlarla kullanımından doğabilecek her türlü hukuki ve cezai sorumluluk münhasıran Kullanıcı’ya aittir.</p>
<h3>5. Hizmet Kesintileri</h3>
<p>Hizmet Sağlayıcı, sunucu kesintileri, telekomünikasyon altyapısından kaynaklanan aksaklıklar, veri güncellemelerindeki gecikmeler veya üçüncü taraf kaynaklı bilgi hatalarından sorumlu tutulamaz. Program "olduğu gibi" sunulmakta olup, kesintisiz veya hatasız çalışacağına dair herhangi bir garanti verilmemektedir.</p>
<h3>6. İletişim ve Resmi Bildirimler</h3>
<p>İşbu Koşullar veya Program’ına ilişkin her türlü soru, talep ve bildirimleriniz için resmi iletişim kanallarımız üzerinden bizimle irtibata geçebilirsiniz:</p>
<p>• <strong>Web Adresi:</strong> www.whichwin-horserace.com<br/>• <strong>E-posta Adresi:</strong> info@whichwin-horserace.com</p>`;

const enTerms = `<h2>TERMS OF USE AND LEGAL DISCLAIMER</h2>
<p><strong>Last Updated:</strong> September 3, 2026</p>
<p>These Terms of Use ("Terms") govern the procedures and principles regarding the use of digital services provided by the <strong>Which Win Horse Race Analysis Program</strong> ("Program"). By downloading, installing, or in any way using the Program, you declare that you accept these terms in full.</p>
<h3>1. Parties and Scope</h3>
<p>This document defines the legal framework between the Which Win Horse Race Analysis Program (hereinafter referred to as the "Service Provider") and the end user ("User") who uses the Program on mobile devices or digital platforms.</p>
<h3>2. Nature of the Service and Limitation of Liability</h3>
<p>• Which Win Horse Race Analysis Program is exclusively an information, analysis, and data program that provides statistical data, historical performance records, ratings, and analytical predictions for horse races.</p>
<p>• <strong>The Program is strictly NOT a betting, gambling, or games-of-chance platform or organizer; Which Win Horse Race under no circumstances conducts betting, accepts betting slips/coupons, or provides brokerage/intermediary services.</strong></p>
<p>• All data and analysis provided are solely for statistical information and evaluation purposes. The Which Win Horse Race program and its developers cannot be held liable under any circumstances for any direct or indirect material or moral damages arising from any transactions, preferences, or activities carried out by users based on program data.</p>
<h3>3. Intellectual Property Rights</h3>
<p>• The Program's interface, software codes, logos, database structures, graphic designs, and textual content belong to the <strong>Which Win</strong> brand and are protected under relevant intellectual property laws and international conventions.</p>
<p>• The User may not copy, reproduce, commercially transfer to third parties, or reverse-engineer the Program's content without prior written permission.</p>
<h3>4. User Responsibilities</h3>
<p>• The User is obliged to use the Program in compliance with applicable national and international legislation, good-faith principles, and general morality.</p>
<p>• Access to horse racing and related analysis content by individuals under the age of 18 is prohibited. The User declares and undertakes that they meet the legal age requirement.</p>
<p>• Any legal and criminal liability arising from the misuse or unlawful use of data obtained through the Program belongs exclusively to the User.</p>
<h3>5. Service Interruptions</h3>
<p>The Service Provider cannot be held responsible for server downtime, telecommunications infrastructure disruptions, data update delays, or information errors originating from third parties. The Program is provided "as is", and no warranty is made that it will operate without interruption or error.</p>
<h3>6. Contact and Official Notices</h3>
<p>For any questions, requests, or notifications regarding these Terms or the Program, you may contact us via our official communication channels:</p>
<p>• <strong>Website:</strong> www.whichwin-horserace.com<br/>• <strong>Email:</strong> info@whichwin-horserace.com</p>`;

const trPrivacy = `<h2>GİZLİLİK POLİTİKASI VE YASAL UYARI</h2>
<p><strong>Son Güncelleme Tarihi:</strong> 3 Eylül 2026</p>
<h3>Gizlilik Sözleşmesi</h3>
<p>Which Win Horse Race Analiz Programı, bir bahis programı değildir ve sunulan tüm içerikler, tamamen yasal sınırlar içinde gerçekleştirilen istatistiksel tahmin ve analiz uygulamalarıdır. Tüm analizler, atların form durumu, derece geçmişleri ve pist koşulları gibi çevresel faktörler göz önünde bulundurularak yapılmaktadır. Hiçbir yasadışı paylaşım ve yasadışı bahis sitesi reklamı yapılmamaktadır. Kişisel verileriniz, ilgili kişinin rızası olmaksızın üçüncü taraflar ve tüzel kişilerle paylaşılamaz ve işlenemez.</p>
<h3>Gizlilik Politikası</h3>
<p>Which Win Horse Race Analiz Programı, bir bahis programı değildir ve sunulan tüm içerikler, tamamen yasal sınırlar içinde gerçekleştirilen tahmin ve analiz uygulamalarıdır. Tüm değerlendirmeler, atların performans durumları ve çevresel faktörler göz önünde bulundurularak yapılmaktadır. Hiçbir yasadışı paylaşım ve yasadışı bahis sitesi reklamı yapılmamaktadır. Kişisel verileriniz, ilgili kişinin rızası olmaksızın üçüncü taraflar ve tüzel kişilerle paylaşılamaz ve işlenemez.</p>
<h3>İletişim Bilgileri</h3>
<p>• <strong>Web Adresi:</strong> www.whichwin-horserace.com<br/>• <strong>E-posta Adresi:</strong> info@whichwin-horserace.com</p>`;

const enPrivacy = `<h2>PRIVACY POLICY AND LEGAL DISCLAIMER</h2>
<p><strong>Last Updated:</strong> September 3, 2026</p>
<h3>Privacy Agreement</h3>
<p>Which Win Horse Race Analysis Program is not a betting program, and all provided content consists entirely of statistical prediction and analysis applications conducted within legal boundaries. All analyses are performed taking into account environmental factors such as horses' form status, rating history, and track conditions. No illegal content sharing or advertising of illegal betting sites is conducted. Your personal data cannot be shared with or processed by third parties or legal entities without the explicit consent of the person concerned.</p>
<h3>Privacy Policy</h3>
<p>Which Win Horse Race Analysis Program is not a betting program, and all provided content consists entirely of prediction and analysis applications conducted within legal boundaries. All evaluations are performed taking into account horses' performance status and environmental factors. No illegal content sharing or advertising of illegal betting sites is conducted. Your personal data cannot be shared with or processed by third parties or legal entities without the explicit consent of the person concerned.</p>
<h3>Contact Information</h3>
<p>• <strong>Website:</strong> www.whichwin-horserace.com<br/>• <strong>Email:</strong> info@whichwin-horserace.com</p>`;

const trAbout = `<h2>Hakkımızda</h2>
<p>Which Win, yapay zeka destekli at yarışı analiz, istatistik ve tahmin platformudur. En güncel yarış verileri, jokey ve antrenör performansları ile detaylı analizler sunar.</p>
<h3>İletişim</h3>
<p>• <strong>Web Adresi:</strong> www.whichwin-horserace.com<br/>• <strong>E-posta:</strong> info@whichwin-horserace.com</p>`;

const enAbout = `<h2>About Us</h2>
<p>Which Win is your premier AI-powered horse racing analysis, statistics, and prediction platform. We provide up-to-date race data, jockey and trainer performance metrics, and detailed analytics.</p>
<h3>Contact</h3>
<p>• <strong>Website:</strong> www.whichwin-horserace.com<br/>• <strong>Email:</strong> info@whichwin-horserace.com</p>`;

export async function seedLegalDocuments() {
  console.log("[Seed] Seeding legal documents...");

  const docs = [
    { type: "TERMS_AND_CONDITIONS_TR", content: trTerms },
    { type: "TERMS_AND_CONDITIONS_EN", content: enTerms },
    { type: "TERMS_AND_CONDITIONS", content: trTerms },
    { type: "PRIVACY_POLICY_TR", content: trPrivacy },
    { type: "PRIVACY_POLICY_EN", content: enPrivacy },
    { type: "PRIVACY_POLICY", content: trPrivacy },
    { type: "ABOUT_US_TR", content: trAbout },
    { type: "ABOUT_US_EN", content: enAbout },
    { type: "ABOUT_US", content: trAbout },
  ];

  for (const doc of docs) {
    await prisma.legalDocument.upsert({
      where: { type: doc.type },
      update: { content: doc.content },
      create: { type: doc.type, content: doc.content },
    });
  }

  console.log(`[Seed] ✅ Seeded ${docs.length} legal documents successfully.`);
}

/**
 * Main auto-seed function executed on server startup and via prisma seed.
 */
export async function autoSeedDatabase() {
  console.log("=================================================");
  console.log("🚀 [AutoSeed] Starting automated database seed...");
  try {
    await seedSuperAdmin();
    await seedAlgorithmSettings();
    await seedLegalDocuments();
    console.log("🚀 [AutoSeed] Database seeding completed successfully ✅");
  } catch (error) {
    console.error("❌ [AutoSeed] Failed to seed database:", error);
    throw error;
  }
  console.log("=================================================");
}
