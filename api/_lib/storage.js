import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const LOCAL_STORE_ROOT = path.join(".invoicer", "api-store");

function hasBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

function shouldUseLocalStore() {
  return !hasBlobCredentials() && process.env.VERCEL !== "1";
}

function assertProductionStorage() {
  if (!hasBlobCredentials()) {
    throw new Error(
      "Vercel Blob is not configured. Connect a Blob store to this Vercel project so BLOB_STORE_ID/VERCEL_OIDC_TOKEN or BLOB_READ_WRITE_TOKEN is available."
    );
  }
}

function localPathForKey(key) {
  return path.resolve(process.cwd(), LOCAL_STORE_ROOT, key);
}

function versionPrefixForKey(key) {
  return `${key}.versions/`;
}

function versionedKeyForKey(key) {
  return `${versionPrefixForKey(key)}${Date.now()}-${randomUUID()}.json`;
}

async function readRemoteJson(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Unable to read ${pathname} from Vercel Blob.`);
  }
  const raw = await new Response(result.stream).text();
  return JSON.parse(raw);
}

export async function readJsonStore(key, fallback) {
  if (shouldUseLocalStore()) {
    try {
      const raw = await fs.readFile(localPathForKey(key), "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error?.code === "ENOENT") return fallback;
      throw error;
    }
  }

  assertProductionStorage();
  const versions = await list({
    prefix: versionPrefixForKey(key),
    limit: 1000,
  });
  const latest = versions.blobs
    .filter((blob) => blob.pathname.endsWith(".json"))
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
  if (latest) {
    return await readRemoteJson(latest.pathname);
  }

  return (await readRemoteJson(key)) ?? fallback;
}

export async function writeJsonStore(key, value) {
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  if (shouldUseLocalStore()) {
    const abs = localPathForKey(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, raw, "utf8");
    return;
  }

  assertProductionStorage();
  await put(versionedKeyForKey(key), raw, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export async function writePublicBlob(key, bytes, contentType) {
  if (shouldUseLocalStore()) {
    const publicRoot = path.resolve(process.cwd(), "public");
    const publicPath = key.replace(/^invoicer\/logos\//, "");
    const abs = path.resolve(publicRoot, publicPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, bytes);
    return `/${publicPath}`;
  }

  assertProductionStorage();
  const blob = await put(key, bytes, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  return blob.url;
}
