// Robot UNAC : vols Air France du jour à CDG (départs ET arrivées), pour le Daily de la perm.
// Écrit data/vols-jour.json (données publiques de vols uniquement). Lancé par .github/workflows/vols-jour.yml
// Jour visé : fichier daily-demande/jour.txt (AAAA-MM-JJ), sinon variable JOUR, sinon demain (heure de Paris).
import fs from "node:fs";
const KEY = process.env.AFKL_API_KEY;
if (!KEY) { console.log("Secret AFKL_API_KEY absent"); process.exit(1); }
const TZ = "Europe/Paris", DAILY_CAP = 14;
const parisDay = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
function tzOffsetMin(utcMs) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(new Date(utcMs)).find(p => p.type === "timeZoneName").value;
  const m = s.match(/GMT([+-]\d+)(?::(\d+))?/); return m ? (+m[1]) * 60 + Math.sign(+m[1]) * (+(m[2] || 0)) : 0;
}
function paris(day, hm) { const [y, mo, d] = day.split("-").map(Number), [h, mi] = hm.split(":").map(Number); const g = Date.UTC(y, mo - 1, d, h, mi); return new Date(g - tzOffsetMin(g - 3 * 3600e3) * 60e3); }
const addDays = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoZ = d => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let DAY = process.env.JOUR || "";
try { DAY = DAY || fs.readFileSync("daily-demande/jour.txt", "utf8").trim(); } catch {}
if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY)) DAY = addDays(parisDay(new Date()), 1);

const AC_IATA = { "221": "A220", "223": "A220", "22N": "A220", "318": "A318", "319": "A319", "320": "A320", "32N": "A20N", "321": "A321", "32Q": "A21N",
  "332": "A332", "333": "A333", "339": "A339", "359": "A350", "35K": "A35K", "351": "A35K", "772": "B772", "77W": "B77W", "773": "B773", "788": "B787", "789": "B787", "78X": "B78X", "781": "B78X", "E70": "E170", "E75": "E175", "E90": "E190", "E95": "E195" };
function acShort(code, name) {
  const c = String(code || "").toUpperCase().trim();
  if (AC_IATA[c]) return AC_IATA[c];
  if (/^[AB]\d{3}$/.test(c) || /^[AB]\d{2}[A-Z]$/.test(c)) return c;
  const n = String(name || "").toUpperCase(); let m;
  if (/A ?220|CS ?300|BD-500/.test(n)) return "A220";
  if ((m = n.match(/A ?3(18|19|20|21)/))) return "A3" + m[1];
  if ((m = n.match(/A ?33(0|2|3|9)/))) return "A33" + m[1];
  if (/A ?350/.test(n)) return /1000/.test(n) ? "A35K" : "A350";
  if (/777/.test(n)) return /300|77W/.test(n) ? "B77W" : "B772";
  if (/787/.test(n)) return /10/.test(n.replace(/787/, "")) ? "B78X" : "B787";
  if ((m = n.match(/E(MBRAER)? ?-?(1[79]\d)/))) return "E" + m[2];
  return c.slice(0, 4);
}
const WIDEBODY = new Set(["A330", "A332", "A333", "A339", "A350", "A35K", "A380", "B772", "B77W", "B773", "B787", "B78X"]);
const MC_COUNTRIES = new Set(("FR,DE,AT,BE,BG,CY,HR,DK,ES,EE,FI,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,CZ,RO,SK,SI,SE,GB,CH,NO,IS,LI,MC,AD,SM,VA,RS,BA,ME,MK,AL,XK,UA,MD,BY,RU,GE,AM,AZ,TR,MA,DZ,TN,LY,EG,IL,LB,JO").split(","));
function classifyLc(ac, haul, country) {
  if (ac && WIDEBODY.has(ac)) return true;
  if (ac && /^(A2|A3[12]|E1|CRJ|AT7|DH)/.test(ac)) return false;
  const h = String(haul || "").toUpperCase();
  if (/LONG/.test(h)) return true; if (/MEDIUM|SHORT/.test(h)) return false;
  return country ? !MC_COUNTRIES.has(country) : false;
}
const cap = s => String(s || "").toLowerCase().replace(/(^|[\s\-'/])\p{L}/gu, x => x.toUpperCase());

function normalize(op, kind) {                     // kind : "dep" | "arr"
  if (op.airline && op.airline.code && op.airline.code !== "AF") return null;
  const legs = op.flightLegs || [];
  const leg = kind === "dep"
    ? legs.find(l => l.departureInformation?.airport?.code === "CDG")
    : legs.find(l => l.arrivalInformation?.airport?.code === "CDG");
  if (!leg) return null;
  const ac = leg.aircraft || {};
  if (/^TRN$/i.test(ac.typeCode || "") || /TRAIN|TGV|RAIL/i.test(ac.typeName || "")) return null;
  const hop = /^A5$/i.test(ac.ownerAirlineCode || "") || /HOP/i.test((ac.cabinCrewEmployer || "") + (ac.ownerAirlineName || ""));
  const info = kind === "dep" ? leg.departureInformation : leg.arrivalInformation;
  const other = kind === "dep" ? leg.arrivalInformation?.airport : leg.departureInformation?.airport;
  const t = info.times || {};
  const sched = t.scheduled ? new Date(t.scheduled) : null; if (!sched) return null;
  const est = t.actual || t.estimatedPublic || t.latestPublished;
  const acCode = acShort(ac.typeCode, ac.typeName);
  const prev = op.flightRelations?.previousFlightData;
  return {
    kind, number: "AF " + op.flightNumber, sched, eff: est ? new Date(est) : sched,
    city: cap(other?.city?.name || other?.name || other?.code || "—"), iata: other?.code || "",
    terminal: (() => { const pl = info.airport?.places || {}; let t = String(pl.departureTerminal || pl.arrivalTerminal || pl.boardingTerminal || pl.terminalCode || "").replace(/^T/i, ""); if (/^[A-G]$/i.test(t) && pl.aerogareCode) t = pl.aerogareCode + t; return t; })(),
    ac: acCode, reg: ac.registration || "", lc: classifyLc(acCode, op.haul, other?.city?.country?.code), hop,
    cancelled: leg.irregularity?.cancelled === "Y" || /CANCEL/i.test(leg.legStatusPublic || ""),
    rotation: kind === "dep" && !!(prev && prev.flightScheduleDate === op.flightScheduleDate)
  };
}
let calls = 0;
async function fetchRange(kind, from, to) {
  let all = [], n = 0, pages = 1;
  do {
    if (calls >= DAILY_CAP) { console.warn("Plafond d'appels de l'édition atteint"); break; }
    if (n) await sleep(1100);
    const qs = new URLSearchParams({ startRange: isoZ(from), endRange: isoZ(to), movementType: kind === "dep" ? "D" : "A", timeOriginType: "S", timeType: "U",
      carrierCode: "AF", pageSize: "100", pageNumber: String(n), [kind === "dep" ? "origin" : "destination"]: "CDG" });
    calls++;
    const r = await fetch("https://api.airfranceklm.com/opendata/flightstatus?" + qs, { headers: { "API-Key": KEY, "Accept": "application/hal+json", "Accept-Language": "fr-FR" } });
    if (r.status === 204 || r.status === 404) break;
    if (!r.ok) throw new Error(`API Air France-KLM : HTTP ${r.status}`);
    const j = await r.json(); all = all.concat(j.operationalFlights || []); pages = j.page?.totalPages || 1; n++;
  } while (n < pages && n < 7);
  return all.map(op => normalize(op, kind)).filter(Boolean);
}


const dep = await fetchRange("dep", paris(DAY, "04:30"), paris(addDays(DAY, 1), "01:45"));
await sleep(1100);
const arr = await fetchRange("arr", paris(DAY, "04:00"), paris(addDays(DAY, 1), "00:30"));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/vols-jour.json", JSON.stringify({ jour: DAY, maj: new Date().toISOString(), appels: calls, vols: [...dep, ...arr] }));
console.log(`${DAY} : ${dep.length} départs, ${arr.length} arrivées (${calls} appels)`);
