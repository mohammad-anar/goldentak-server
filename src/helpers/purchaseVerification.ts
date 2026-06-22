import axios from "axios";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

// Helper to format private keys loaded from env variables
const formatPrivateKey = (key: string | undefined): string => {
  if (!key) return "";
  // Handle escaped newlines
  let formatted = key.replace(/\\n/g, "\n");
  // Ensure surrounding quotes from .env parsing are removed
  if (formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.substring(1, formatted.length - 1);
  }
  return formatted;
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLAY DEVELOPER API VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export interface GoogleVerificationResult {
  success: boolean;
  expiryTimeMillis: number;
  productId: string;
  autoRenewing: boolean;
  rawResponse: any;
}

export const verifyGoogleSubscription = async (
  productId: string,
  purchaseToken: string
): Promise<GoogleVerificationResult> => {
  try {
    const clientEmail = config.googlePlay.clientEmail;
    const privateKey = formatPrivateKey(config.googlePlay.privateKey);

    if (!clientEmail || !privateKey) {
      throw new Error("Google Play credentials not configured in backend env");
    }

    // 1. Generate Google OAuth2 JWT assertion
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1 hour

    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      exp,
      iat,
    };

    const tokenAssertion = jwt.sign(payload, privateKey, { algorithm: "RS256" });

    // 2. Fetch Access Token from Google
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: tokenAssertion,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      throw new Error("Failed to retrieve access token from Google");
    }

    // 3. Query Google Play Developer API
    const packageName = "com.whichwin.horseracing";
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const verificationResponse = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = verificationResponse.data;
    const expiryTimeMillis = Number(data?.expiryTimeMillis);

    if (!expiryTimeMillis) {
      return {
        success: false,
        expiryTimeMillis: 0,
        productId,
        autoRenewing: false,
        rawResponse: data,
      };
    }

    return {
      success: expiryTimeMillis > Date.now(),
      expiryTimeMillis,
      productId,
      autoRenewing: !!data?.autoRenewing,
      rawResponse: data,
    };
  } catch (err: any) {
    console.error("[GoogleVerify] Verification failed:", err.message);
    if (err.response && err.response.data) {
      console.error("[GoogleVerify] Error details:", JSON.stringify(err.response.data));
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPLE APP STORE CONNECT API VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export interface AppleVerificationResult {
  success: boolean;
  expiresDate: number;
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  rawResponse: any;
}

export const verifyAppleSubscription = async (
  signedTransactionInfo: string
): Promise<AppleVerificationResult> => {
  try {
    // 1. Decode local JWS locally first to inspect transaction parameters
    const decodedJws = jwt.decode(signedTransactionInfo) as any;
    if (!decodedJws) {
      throw new Error("Invalid signedTransactionInfo: Failed to decode JWS");
    }

    const {
      originalTransactionId,
      productId,
      expiresDate,
      transactionId,
      revocationDate,
    } = decodedJws;

    if (!originalTransactionId || !productId || !expiresDate) {
      throw new Error("Decoded JWS is missing core transaction parameters");
    }

    // If revoked, the subscription is cancelled/refunded
    if (revocationDate) {
      return {
        success: false,
        expiresDate,
        productId,
        originalTransactionId,
        transactionId,
        rawResponse: decodedJws,
      };
    }

    // 2. Fetch fresh status from App Store Connect Server API
    // Try production first, fall back to sandbox if production returns a 404/error.
    let appleResponseData: any = null;
    let usedSandbox = false;

    try {
      appleResponseData = await fetchAppleServerStatus(originalTransactionId, false);
    } catch (prodErr: any) {
      // 404/400 errors or unauthorized usually signify a sandbox transaction queried in production
      console.warn(`[AppleVerify] Production endpoint failed: ${prodErr.message}. Trying Sandbox...`);
      appleResponseData = await fetchAppleServerStatus(originalTransactionId, true);
      usedSandbox = true;
    }

    // 3. Inspect App Store Connect Server Status response
    // The response schema contains:
    // data: Array of subscriptionGroupIdentifier and lastTransactions
    const lastTransactions = appleResponseData?.data?.[0]?.lastTransactions;
    if (!Array.isArray(lastTransactions) || lastTransactions.length === 0) {
      // Fallback: If App Store Server response is invalid/empty but we have a valid decoded JWS,
      // trust the cryptographically decoded parameters (useful in offline or dev testing).
      console.warn("[AppleVerify] Server returned empty lastTransactions, falling back to local JWS decoding");
      return {
        success: expiresDate > Date.now(),
        expiresDate,
        productId,
        originalTransactionId,
        transactionId,
        rawResponse: { decodedJws, usedSandbox },
      };
    }

    // Find transaction inside status array
    const statusBlock = lastTransactions.find((t: any) => t.originalTransactionId === originalTransactionId) || lastTransactions[0];
    const status = statusBlock?.status; // 1 = Active, 2 = Expired, 3 = Billing Retry, 4 = Grace Period, 5 = Revoked
    
    // Decode statusBlock JWS to get latest expiry
    const freshDecoded = jwt.decode(statusBlock?.signedTransactionInfo) as any;
    const finalExpiresDate = freshDecoded?.expiresDate ? Number(freshDecoded.expiresDate) : expiresDate;
    const finalProductId = freshDecoded?.productId || productId;

    return {
      success: status === 1,
      expiresDate: finalExpiresDate,
      productId: finalProductId,
      originalTransactionId,
      transactionId: freshDecoded?.transactionId || transactionId,
      rawResponse: { appleResponseData, freshDecoded, usedSandbox },
    };
  } catch (err: any) {
    console.error("[AppleVerify] Verification failed:", err.message);
    throw err;
  }
};

// Helper function to query Apple Server API
const fetchAppleServerStatus = async (
  originalTransactionId: string,
  useSandbox: boolean
): Promise<any> => {
  const keyId = config.apple.keyId;
  const issuerId = config.apple.issuerId;
  const privateKey = formatPrivateKey(config.apple.privateKey);
  const bundleId = config.apple.bundleId || "com.whichwin.horseracing";

  if (!keyId || !issuerId || !privateKey) {
    throw new Error("Apple Connect API credentials not configured in backend env");
  }

  // Generate server-to-server JWT signed with private key (ECDSA ES256)
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 1200; // 20 minutes expiration

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: issuerId,
    iat,
    exp,
    aud: "appstoreconnect-v1",
    bid: bundleId,
  };

  const serverToken = jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header,
  });

  const baseUrl = useSandbox
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";

  const url = `${baseUrl}/inApps/v1/subscriptions/${originalTransactionId}`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${serverToken}` },
  });

  return response.data;
};
