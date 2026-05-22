import admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

export const initFirebase = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey || projectId === "your-project-id") {
    console.warn("⚠️ Firebase credentials missing in environment variables. FCM notifications will be skipped.");
    return null;
  }

  try {
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    });
    console.log("🔥 Firebase Admin SDK initialized successfully.");
    return firebaseApp;
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
};

export const sendPushNotification = async (
  token: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) => {
  if (!firebaseApp) {
    console.warn("⚠️ FCM notification skipped: Firebase not initialized.");
    return false;
  }

  try {
    await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
    return true;
  } catch (error) {
    console.error(`❌ FCM notification failed to token ${token}:`, error);
    return false;
  }
};

export const sendMulticastPushNotification = async (
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
) => {
  if (!firebaseApp) {
    console.warn("⚠️ Multicast FCM notification skipped: Firebase not initialized.");
    return false;
  }
  if (tokens.length === 0) return true;

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
    console.log(`✉️ Sent push notifications: ${response.successCount} successful, ${response.failureCount} failed.`);
    return true;
  } catch (error) {
    console.error("❌ Multicast FCM notification failed:", error);
    return false;
  }
};
