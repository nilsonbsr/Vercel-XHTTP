export const config = { runtime: "edge" };

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// لیست هدرهایی که نباید حذف شوند یا باید تغییر کنند
const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Configuration Error: TARGET_DOMAIN is missing", { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const newHeaders = new Headers();
    let clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");

    for (const [key, value] of req.headers) {
      const lowerKey = key.toLowerCase();
      
      // اجازه عبور به هدر پدینگ که در عکس خواستید (X-Signature)
      if (lowerKey === "x-signature") {
        newHeaders.set(key, value);
        continue;
      }

      if (STRIP_HEADERS.has(lowerKey) || lowerKey.startsWith("x-vercel-")) {
        continue;
      }
      
      newHeaders.set(key, value);
    }

    if (clientIp) {
      newHeaders.set("x-forwarded-for", clientIp.split(',')[0].trim());
    }
 
    return await fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    return new Response("Relay Error", { status: 502 });
  }
}