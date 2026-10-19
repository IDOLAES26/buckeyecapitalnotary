// Buckeye Capital Notary fee estimator. Secrets belong in Cloudflare settings.
const ORIGINS = new Set([
  "https://idolaes26.github.io",
  "https://buckeyecapitalnotary.com",
  "https://www.buckeyecapitalnotary.com"
]);
const ALLOWED = ["education.library", "service.post.office", "healthcare.hospital",
  "service.social_facility.nursing_home", "service.funeral_directors", "office.lawyer"];
let originCache;
const recent = new Map();

export function travelFee(meters) {
  if (!Number.isFinite(meters) || meters < 0) throw new Error("Invalid route");
  const miles = meters / 1609.344;
  return miles <= 10 ? 30 : miles <= 20 ? 45 : miles <= 30 ? 60 : null;
}
export function eligible(p) {
  const cats = p.categories || [], raw = p.datasource?.raw || {};
  if (!p.name || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
  if (["private", "no"].includes(raw.access) || ["house", "residential"].includes(raw.building)) return false;
  if (cats.some(c => c.includes("parcel_locker") || c === "service.post.box")) return false;
  if (cats.includes("education.library") && /university|college|school|medical|law library/i.test(p.name)) return false;
  return ALLOWED.some(c => cats.includes(c)) ||
    (cats.includes("catering.cafe") && /starbucks/i.test(p.name + " " + (raw.brand || ""))) ||
    (cats.includes("commercial") && /fedex|kinko/i.test(p.name + " " + (raw.brand || "")));
}
async function api(path, params, key) {
  const url = new URL(path, "https://api.geoapify.com");
  for (const [k,v] of Object.entries({...params, apiKey:key})) url.searchParams.set(k,v);
  const r = await fetch(url, {signal:AbortSignal.timeout(12000)});
  if (!r.ok) throw new Error("Provider unavailable");
  return r.json();
}
async function startingPoint(env) {
  if (originCache?.address === env.STARTING_ADDRESS && originCache.expires > Date.now()) return originCache.point;
  const data = await api("/v1/geocode/search", {
    text:env.STARTING_ADDRESS, filter:"countrycode:us", format:"json", limit:1
  }, env.GEOAPIFY_API_KEY);
  const p = data.results?.[0];
  // Refuse city/ZIP approximations for the private origin.
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
      !p.housenumber || !p.street || p.state_code !== "OH" ||
      p.rank?.match_type !== "full_match") throw new Error("Origin needs review");
  originCache = {address:env.STARTING_ADDRESS, point:{lat:p.lat,lon:p.lon},expires:Date.now()+86400000};
  return originCache.point;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = {
      "Content-Type":"application/json", "Cache-Control":"no-store",
      "Vary":"Origin", "X-Content-Type-Options":"nosniff",
      ...(ORIGINS.has(origin) ? {"Access-Control-Allow-Origin":origin,
        "Access-Control-Allow-Methods":"POST, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type"} : {})
    };
    const reply = (body, status=200) => new Response(JSON.stringify(body),{status,headers});
    if (request.method === "GET" && new URL(request.url).pathname === "/") {
      return reply({service:"Buckeye Capital Notary fee estimator",status:"ready"});
    }
    if (!ORIGINS.has(origin)) return reply({error:"Request not allowed."},403);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (new URL(request.url).pathname !== "/estimate") return reply({error:"Not found."},404);
    if (request.method !== "POST") return reply({error:"Use POST."},405);
    if (!request.headers.get("Content-Type")?.includes("application/json")) return reply({error:"Use JSON."},415);
    // Best-effort per-instance throttle; provider quotas still apply.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now(), window = recent.get(ip);
    if (window && now-window.start < 60000 && window.count >= 10) return reply({error:"Please wait a minute before trying again."},429);
    recent.set(ip,window && now-window.start < 60000 ? {start:window.start,count:window.count+1} : {start:now,count:1});
    if (recent.size > 2000) for (const [k,v] of recent) if(now-v.start > 60000) recent.delete(k);
    if (!env.STARTING_ADDRESS || !env.GEOAPIFY_API_KEY) return reply({error:"Estimator setup is incomplete. Contact us for a quote."},503);
    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return reply({error:"Request too large."},413);
      body = JSON.parse(text);
    } catch { return reply({error:"Invalid request."},400); }
    const {placeId, acts} = body || {};
    if (typeof placeId !== "string" || !/^[a-zA-Z0-9_-]{10,600}$/.test(placeId)) return reply({error:"Select a listed meeting location."},400);
    if (acts !== null && (!Number.isInteger(acts) || acts < 1 || acts > 100)) return reply({error:"Choose 1–100 notarial acts, or Not sure."},400);
    try {
      const details = await api("/v2/place-details",{id:placeId,features:"details"},env.GEOAPIFY_API_KEY);
      const p = details.features?.find(f => f.properties?.feature_type === "details")?.properties;
      if (!p || !eligible(p) || p.lat < 39.2 || p.lat > 40.7 || p.lon < -84 || p.lon > -82) {
        return reply({error:"Choose a listed public, business, or facility meeting location near Columbus. Residential meeting addresses are not accepted."},422);
      }
      const start = await startingPoint(env);
      const route = await api("/v1/routing",{
        waypoints:start.lat+","+start.lon+"|"+p.lat+","+p.lon,
        mode:"drive",type:"balanced",units:"metric"
      },env.GEOAPIFY_API_KEY);
      const meters = route.features?.[0]?.properties?.distance;
      const travel = travelFee(meters);
      const notarial = acts === null ? null : acts * 5;
      // Never return origin, precise distance, duration, geometry, or provider payloads.
      return reply({
        currency:"USD",placeId,acts,perAct:5,notarialFee:notarial,travelFee:travel,
        estimatedTotal:travel === null || notarial === null ? null : travel+notarial,
        needsQuote:travel === null || acts === null,
        note:travel === null ? "Travel over 30 miles requires a custom quote." :
          acts === null ? "Travel estimate shown; we will confirm the number of notarial acts." :
          "Estimated fee only. The final fees and travel charge must be agreed before notarization."
      });
    } catch {
      return reply({error:"We could not calculate an estimate. Please contact us for a quote."},503);
    }
  }
};
