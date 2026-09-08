import { prisma } from '../../../helpers/prisma.js';
import ApiError from '../../../errors/ApiError.js';

const createOrUpdate = async (type: string, content: string) => {
  const result = await prisma.legalDocument.upsert({
    where: { type },
    update: { content },
    create: { type, content },
  });
  return result;
};

const getByType = async (type: string, lang: string = 'en') => {
  const upperType = type.toUpperCase();
  const isTerms = upperType.includes('TERM');
  const isPrivacy = upperType.includes('PRIVACY');
  const isAbout = upperType.includes('ABOUT');

  const baseType = isTerms ? 'TERMS_AND_CONDITIONS' : isPrivacy ? 'PRIVACY_POLICY' : isAbout ? 'ABOUT_US' : upperType;
  const localizedKey = `${baseType}_${lang.toUpperCase()}`;

  let result = await prisma.legalDocument.findFirst({
    where: {
      OR: [
        { type: localizedKey },
        { type: baseType },
      ]
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (!result) {
    const defaultContents: Record<string, Record<string, string>> = {
      TERMS_AND_CONDITIONS: {
        tr: `<h2>KULLANIM KOŞULLARI VE YASAL UYARI</h2>
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
<p>• <strong>Web Adresi:</strong> www.whichwin-horserace.com<br/>• <strong>E-posta Adresi:</strong> info@whichwin-horserace.com</p>`,
        en: `<h2>TERMS OF USE AND LEGAL DISCLAIMER</h2>
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
<p>• <strong>Website:</strong> www.whichwin-horserace.com<br/>• <strong>Email:</strong> info@whichwin-horserace.com</p>`,
      },
      PRIVACY_POLICY: {
        tr: `<h2>GİZLİLİK POLİTİKASI VE YASAL UYARI</h2>
<p><strong>Son Güncelleme Tarihi:</strong> 3 Eylül 2026</p>
<h3>Gizlilik Sözleşmesi</h3>
<p>Which Win Horse Race Analiz Programı, bir bahis programı değildir ve sunulan tüm içerikler, tamamen yasal sınırlar içinde gerçekleştirilen istatistiksel tahmin ve analiz uygulamalarıdır. Tüm analizler, atların form durumu, derece geçmişleri ve pist koşulları gibi çevresel faktörler göz önünde bulundurularak yapılmaktadır. Hiçbir yasadışı paylaşım ve yasadışı bahis sitesi reklamı yapılmamaktadır. Kişisel verileriniz, ilgili kişinin rızası olmaksızın üçüncü taraflar ve tüzel kişilerle paylaşılamaz ve işlenemez.</p>
<h3>Gizlilik Politikası</h3>
<p>Which Win Horse Race Analiz Programı, bir bahis programı değildir ve sunulan tüm içerikler, tamamen yasal sınırlar içinde gerçekleştirilen tahmin ve analiz uygulamalarıdır. Tüm değerlendirmeler, atların performans durumları ve çevresel faktörler göz önünde bulundurularak yapılmaktadır. Hiçbir yasadışı paylaşım ve yasadışı bahis sitesi reklamı yapılmamaktadır. Kişisel verileriniz, ilgili kişinin rızası olmaksızın üçüncü taraflar ve tüzel kişilerle paylaşılamaz ve işlenemez.</p>
<h3>İletişim Bilgileri</h3>
<p>• <strong>Web Adresi:</strong> www.whichwin-horserace.com<br/>• <strong>E-posta Adresi:</strong> info@whichwin-horserace.com</p>`,
        en: `<h2>PRIVACY POLICY AND LEGAL DISCLAIMER</h2>
<p><strong>Last Updated:</strong> September 3, 2026</p>
<h3>Privacy Agreement</h3>
<p>Which Win Horse Race Analysis Program is not a betting program, and all provided content consists entirely of statistical prediction and analysis applications conducted within legal boundaries. All analyses are performed taking into account environmental factors such as horses' form status, rating history, and track conditions. No illegal content sharing or advertising of illegal betting sites is conducted. Your personal data cannot be shared with or processed by third parties or legal entities without the explicit consent of the person concerned.</p>
<h3>Privacy Policy</h3>
<p>Which Win Horse Race Analysis Program is not a betting program, and all provided content consists entirely of prediction and analysis applications conducted within legal boundaries. All evaluations are performed taking into account horses' performance status and environmental factors. No illegal content sharing or advertising of illegal betting sites is conducted. Your personal data cannot be shared with or processed by third parties or legal entities without the explicit consent of the person concerned.</p>
<h3>Contact Information</h3>
<p>• <strong>Website:</strong> www.whichwin-horserace.com<br/>• <strong>Email:</strong> info@whichwin-horserace.com</p>`,
      },
      ABOUT_US: {
        tr: "<h1>Hakkımızda</h1><p>Which Win, yapay zeka destekli at yarışı analiz ve tahmin platformudur.</p>",
        en: "<h1>About Us</h1><p>Which Win is your premier horse racing analysis and AI prediction platform.</p>"
      }
    };

    const selectedCategory = defaultContents[baseType];
    if (selectedCategory) {
      const contentToUse = selectedCategory[lang] || selectedCategory['en'];
      result = await prisma.legalDocument.upsert({
        where: { type: localizedKey },
        update: { content: contentToUse },
        create: { type: localizedKey, content: contentToUse }
      });
    }
  }

  if (!result) throw new ApiError(404, 'Document not found');
  return result;
};

const getAll = async () => {
  return await prisma.legalDocument.findMany();
};

export const LegalService = {
  createOrUpdate,
  getByType,
  getAll,
};
