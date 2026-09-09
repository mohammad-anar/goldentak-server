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
  basePlanId?: string;
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

    const packageName = "com.whichwin.horseracing";

    // Helper to auto-acknowledge Google Play subscription
    const autoAcknowledge = async (targetProductId: string) => {
      try {
        const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${targetProductId}/tokens/${purchaseToken}:acknowledge`;
        await axios.post(
          ackUrl,
          {},
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log(`[GoogleVerify] Successfully acknowledged subscription for product: ${targetProductId}`);
      } catch (ackErr: any) {
        console.warn(`[GoogleVerify] Note: Acknowledge request returned: ${ackErr?.response?.data?.error?.message || ackErr.message}`);
      }
    };

    // 3. Strategy A: Try Google Play Developer API Subscriptions v2 (Recommended for Base Plans)
    try {
      const v2Url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
      const v2Response = await axios.get(v2Url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const v2Data = v2Response.data;
      if (v2Data && v2Data.lineItems && v2Data.lineItems.length > 0) {
        const lineItem = v2Data.lineItems[0];
        const v2ProductId = lineItem.productId || productId;
        const basePlanId = lineItem.offerDetails?.basePlanId || "";
        const expiryTimeMillis = lineItem.expiryTime ? new Date(lineItem.expiryTime).getTime() : 0;
        const subState = v2Data.subscriptionState; // SUBSCRIPTION_STATE_ACTIVE, SUBSCRIPTION_STATE_IN_GRACE_PERIOD

        const isActive =
          (subState === "SUBSCRIPTION_STATE_ACTIVE" || subState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") &&
          expiryTimeMillis > Date.now();

        // Auto-acknowledge if pending
        if (v2Data.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
          await autoAcknowledge(v2ProductId);
        }

        console.log(`[GoogleVerify v2] Success. Product: ${v2ProductId}, BasePlan: ${basePlanId}, State: ${subState}, Expires: ${new Date(expiryTimeMillis).toISOString()}`);

        return {
          success: isActive,
          expiryTimeMillis,
          productId: v2ProductId,
          basePlanId,
          autoRenewing: lineItem.autoRenewingPlan !== undefined,
          rawResponse: v2Data,
        };
      }
    } catch (v2Err: any) {
      console.warn(`[GoogleVerify] Subscriptions v2 query returned (${v2Err.message}). Falling back to v1 API.`);
    }

    // 4. Strategy B: Fallback to Google Play Developer API v1
    const v1Url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const verificationResponse = await axios.get(v1Url, {
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

    // Auto-acknowledge if pending in v1 (acknowledgementState === 0)
    if (data.acknowledgementState === 0) {
      await autoAcknowledge(productId);
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
export interface AppleVerificationPayload {
  signedTransactionInfo?: string;
  receiptData?: string;
  transactionId?: string;
  productId?: string;
  deviceId?: string;
}

export interface AppleVerificationResult {
  success: boolean;
  expiresDate: number;
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  rawResponse: any;
}

export const verifyAppleSubscription = async (
  payloadOrReceipt: string | AppleVerificationPayload
): Promise<AppleVerificationResult> => {
  try {
    let receiptData = "";
    let transactionId = "";
    let productId = "";

    if (typeof payloadOrReceipt === "string") {
      receiptData = payloadOrReceipt;
    } else if (payloadOrReceipt && typeof payloadOrReceipt === "object") {
      receiptData = payloadOrReceipt.receiptData || payloadOrReceipt.signedTransactionInfo || "";
      transactionId = payloadOrReceipt.transactionId || "";
      productId = payloadOrReceipt.productId || "";
    }

    console.log(`[AppleVerify] Processing Apple verification. Has receipt: ${!!receiptData}, TransactionId: ${transactionId}, ProductId: ${productId}`);

    // Check if receiptData is a 3-part JWS JWT token
    const isJws = typeof receiptData === "string" && receiptData.split(".").length === 3;

    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 1: Apple StoreKit 1 Receipt Validation (verifyReceipt endpoint)
    // Used when Flutter sends standard Base64 PKCS#7 Apple App Receipt
    // ─────────────────────────────────────────────────────────────────────────
    if (receiptData && !isJws) {
      console.log("[AppleVerify] Attempting StoreKit 1 verifyReceipt verification...");
      const receiptResult = await verifyAppleReceiptViaStoreKit1(receiptData, productId);
      if (receiptResult) {
        console.log(`[AppleVerify] StoreKit 1 verification succeeded. ProductId: ${receiptResult.productId}, OriginalTransactionId: ${receiptResult.originalTransactionId}`);
        return receiptResult;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 2: Decode JWS token (StoreKit 2)
    // ─────────────────────────────────────────────────────────────────────────
    let decodedJws: any = null;
    if (isJws) {
      try {
        decodedJws = jwt.decode(receiptData) as any;
        console.log("[AppleVerify] Successfully decoded JWS token payload");
      } catch (decodeErr: any) {
        console.warn("[AppleVerify] Failed to decode JWS token:", decodeErr.message);
      }
    }

    const effectiveOriginalTxId = decodedJws?.originalTransactionId || transactionId;
    const effectiveTxId = decodedJws?.transactionId || transactionId;
    const effectiveProductId = decodedJws?.productId || productId;

    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 3: App Store Connect Server API v2 (GET /inApps/v1/subscriptions/{id})
    // ─────────────────────────────────────────────────────────────────────────
    if (effectiveOriginalTxId || effectiveTxId) {
      const targetTxId = effectiveOriginalTxId || effectiveTxId;
      console.log(`[AppleVerify] Querying App Store Server API for transactionId: ${targetTxId}`);
      let appleResponseData: any = null;
      let usedSandbox = false;

      try {
        appleResponseData = await fetchAppleServerStatus(targetTxId, false);
      } catch (prodErr: any) {
        console.warn(`[AppleVerify] Server API Production failed: ${prodErr.message}. Trying Sandbox...`);
        try {
          appleResponseData = await fetchAppleServerStatus(targetTxId, true);
          usedSandbox = true;
        } catch (sandboxErr: any) {
          console.warn(`[AppleVerify] Server API Sandbox also failed: ${sandboxErr.message}`);
        }
      }

      if (appleResponseData) {
        // 1. Check if subscriptions endpoint response
        const lastTransactions = appleResponseData?.data?.[0]?.lastTransactions;
        if (Array.isArray(lastTransactions) && lastTransactions.length > 0) {
          const statusBlock = lastTransactions.find((t: any) => t.originalTransactionId === targetTxId) || lastTransactions[0];
          const status = statusBlock?.status; // 1 = Active, 2 = Expired, 3 = Billing Retry, 4 = Grace Period, 5 = Revoked
          const freshDecoded = jwt.decode(statusBlock?.signedTransactionInfo) as any;
          const finalExpiresDate = freshDecoded?.expiresDate ? Number(freshDecoded.expiresDate) : (decodedJws?.expiresDate ? Number(decodedJws.expiresDate) : Date.now() + 30 * 86400000);
          const finalProductId = freshDecoded?.productId || effectiveProductId || "com.whichwin.horseracing.weekly";

          return {
            success: status === 1,
            expiresDate: finalExpiresDate,
            productId: finalProductId,
            originalTransactionId: freshDecoded?.originalTransactionId || targetTxId,
            transactionId: freshDecoded?.transactionId || targetTxId,
            rawResponse: { appleResponseData, freshDecoded, usedSandbox },
          };
        }

        // 2. Check if transactions endpoint response
        if (appleResponseData?.signedTransactionInfo) {
          const freshDecoded = jwt.decode(appleResponseData.signedTransactionInfo) as any;
          const expiresDate = freshDecoded?.expiresDate ? Number(freshDecoded.expiresDate) : Date.now() + 30 * 86400000;
          return {
            success: !freshDecoded?.revocationDate && expiresDate > Date.now(),
            expiresDate,
            productId: freshDecoded?.productId || effectiveProductId || "com.whichwin.horseracing.weekly",
            originalTransactionId: freshDecoded?.originalTransactionId || targetTxId,
            transactionId: freshDecoded?.transactionId || targetTxId,
            rawResponse: { appleResponseData, freshDecoded, usedSandbox },
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 4: Decoded JWS token fallback
    // ─────────────────────────────────────────────────────────────────────────
    if (decodedJws) {
      const expiresDate = Number(decodedJws.expiresDate || (Date.now() + 30 * 86400000));
      const fallbackTxId = transactionId || `apple_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const safeOrigTxId = decodedJws.originalTransactionId || fallbackTxId;
      const safeTxId = decodedJws.transactionId || fallbackTxId;
      return {
        success: !decodedJws.revocationDate && expiresDate > Date.now(),
        expiresDate,
        productId: decodedJws.productId || productId || "com.whichwin.horseracing.weekly",
        originalTransactionId: safeOrigTxId,
        transactionId: safeTxId,
        rawResponse: decodedJws,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STRATEGY 5: If receipt was sent as JWS but failed StoreKit 1 first, try verifyReceipt
    // ─────────────────────────────────────────────────────────────────────────
    if (receiptData && isJws) {
      console.log("[AppleVerify] Trying StoreKit 1 verifyReceipt for token as last resort...");
      const receiptResult = await verifyAppleReceiptViaStoreKit1(receiptData, productId);
      if (receiptResult) {
        return receiptResult;
      }
    }

    throw new Error("Apple App Store subscription verification failed: unable to verify receipt or transaction");
  } catch (err: any) {
    console.error("[AppleVerify] Verification error:", err.message);
    throw err;
  }
};

// Helper function to verify Apple Base64 PKCS#7 receipt via StoreKit 1 verifyReceipt
const verifyAppleReceiptViaStoreKit1 = async (
  receiptData: string,
  fallbackProductId?: string
): Promise<AppleVerificationResult | null> => {
  const password = config.apple.password;
  const requestBody: any = {
    "receipt-data": receiptData,
    "exclude-old-transactions": false,
  };
  if (password) {
    requestBody.password = password;
  }

  let verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
  let response: any;

  try {
    response = await axios.post(verifyUrl, requestBody, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
  } catch (err: any) {
    console.warn("[AppleVerify] Production verifyReceipt post failed:", err.message);
  }

  let data = response?.data;

  // Status 21007: Sandbox receipt used in production. Switch to sandbox endpoint.
  if (data?.status === 21007 || !data) {
    console.log("[AppleVerify] Status 21007: Switching to Sandbox verifyReceipt URL...");
    try {
      verifyUrl = "https://sandbox.itunes.apple.com/verifyReceipt";
      response = await axios.post(verifyUrl, requestBody, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });
      data = response.data;
    } catch (sandboxErr: any) {
      console.warn("[AppleVerify] Sandbox verifyReceipt failed:", sandboxErr.message);
    }
  } else if (data?.status === 21008) {
    // Status 21008: Production receipt sent to sandbox
    try {
      verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
      response = await axios.post(verifyUrl, requestBody, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });
      data = response.data;
    } catch (prodErr: any) {
      console.warn("[AppleVerify] Retry Production verifyReceipt failed:", prodErr.message);
    }
  }

  if (data?.status === 0) {
    const transactions = data.latest_receipt_info || data.receipt?.in_app || [];

    if (Array.isArray(transactions) && transactions.length > 0) {
      // Sort transactions by expiry date (or purchase date) descending
      const sorted = [...transactions].sort((a: any, b: any) => {
        const expA = Number(a.expires_date_ms || a.purchase_date_ms || 0);
        const expB = Number(b.expires_date_ms || b.purchase_date_ms || 0);
        return expB - expA;
      });

      const latest = sorted[0];
      const prodId = latest.product_id || fallbackProductId || "com.whichwin.horseracing.weekly";
      const originalTransactionId = latest.original_transaction_id || latest.transaction_id || "";
      const transactionId = latest.transaction_id || originalTransactionId;
      const expiresDate = Number(latest.expires_date_ms || (Number(latest.purchase_date_ms) + 30 * 24 * 60 * 60 * 1000));
      const isRevoked = !!latest.cancellation_date_ms;

      return {
        success: !isRevoked && (expiresDate > Date.now() || data.status === 0),
        expiresDate,
        productId: prodId,
        originalTransactionId,
        transactionId,
        rawResponse: data,
      };
    } else if (data.receipt) {
      const uniqueFallback = `apple_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        expiresDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        productId: fallbackProductId || "com.whichwin.horseracing.weekly",
        originalTransactionId: data.receipt.original_transaction_id || uniqueFallback,
        transactionId: data.receipt.transaction_id || uniqueFallback,
        rawResponse: data,
      };
    }
  }

  console.warn(`[AppleVerify] verifyReceipt returned non-zero status: ${data?.status}`);
  return null;
};

// Helper function to query Apple App Store Server API v2
const fetchAppleServerStatus = async (
  transactionId: string,
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

  try {
    const url = `${baseUrl}/inApps/v1/subscriptions/${transactionId}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${serverToken}` },
      timeout: 10000,
    });
    return response.data;
  } catch (err: any) {
    // If subscriptions endpoint 404s, try transactions endpoint
    const txUrl = `${baseUrl}/inApps/v1/transactions/${transactionId}`;
    const txResponse = await axios.get(txUrl, {
      headers: { Authorization: `Bearer ${serverToken}` },
      timeout: 10000,
    });
    return txResponse.data;
  }
};
