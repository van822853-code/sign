import crypto from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const CHECKINS_COLLECTION = process.env.FIREBASE_CHECKINS_COLLECTION || "ensembleCheckins";

function extractJsonObject(value) {
  try {
    JSON.parse(value);
    return value;
  } catch {
    const start = value.indexOf("{");
    if (start === -1) return value;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const char = value[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) return value.slice(start, index + 1);
      }
    }
    return value;
  }
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const decoded = raw.trim().startsWith("{")
    ? raw.trim()
    : Buffer.from(raw.trim(), "base64").toString("utf8").trim();
  const serviceAccount = JSON.parse(extractJsonObject(decoded));
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

function getProjectId(serviceAccount) {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    serviceAccount?.project_id
  );
}

export function getAdminDb() {
  try {
    if (!getApps().length) {
      const serviceAccount = parseServiceAccount();
      const projectId = getProjectId(serviceAccount);

      if (!serviceAccount && !projectId) {
        throw new ApiError(503, "Firebase Admin is not configured");
      }

      initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId,
      });
    }

    return getFirestore();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Firebase Admin initialization failed", error);
    throw new ApiError(503, "Firebase Admin is not configured");
  }
}

function serializeCheckin(id, data) {
  return {
    id,
    name: String(data.name || ""),
    photo: String(data.photo || ""),
    identity: String(data.identity || ""),
    aiFeeling: String(data.aiFeeling || ""),
    promptWish: String(data.promptWish || ""),
    voiceType: String(data.voiceType || ""),
    timestamp: String(data.timestamp || data.createdAt || new Date(0).toISOString()),
  };
}

export async function listCheckins() {
  const snapshot = await getAdminDb().collection(CHECKINS_COLLECTION).orderBy("timestamp", "asc").limit(300).get();
  return snapshot.docs.map((doc) => serializeCheckin(doc.id, doc.data()));
}

export async function createCheckin(input) {
  const name = String(input?.name || "").trim();
  const identity = String(input?.identity || "").trim();
  const aiFeeling = String(input?.aiFeeling || "").trim();
  const photo = String(input?.photo || "").trim();

  if (!name) throw new ApiError(400, "请输入你的姓名或昵称");
  if (!identity) throw new ApiError(400, "请选择身份");
  if (!aiFeeling) throw new ApiError(400, "请选择你现在面对 AI 的感觉");
  if (!photo) throw new ApiError(400, "请上传头像");

  const timestamp = new Date().toISOString();
  const ref = getAdminDb().collection(CHECKINS_COLLECTION).doc();
  const entry = {
    id: ref.id,
    name,
    photo,
    identity,
    aiFeeling,
    promptWish: String(input?.promptWish || "").trim(),
    voiceType: String(input?.voiceType || ""),
    timestamp,
    requestId: crypto.randomUUID(),
  };

  await ref.set(entry);
  return serializeCheckin(ref.id, entry);
}

export async function deleteCheckinById(id) {
  if (!id) throw new ApiError(400, "缺少签到记录 ID");
  await getAdminDb().collection(CHECKINS_COLLECTION).doc(id).delete();
  return { ok: true };
}

export function sendApiError(res, error) {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "服务器错误";
  res.status(statusCode).json({ error: message });
}
