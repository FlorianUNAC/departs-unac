// Robot UNAC : récupère les départs Air France de CDG (API Air France-KLM Open Data)
// et écrit data/flights.json, lu par le tableau en ligne. Lancé par GitHub Actions.
// La clé est fournie par le secret AFKL_API_KEY (jamais écrite dans le dépôt).
import fs from "node:fs";

const KEY = process.env.AFKL_API_KEY;
const OUT = "data/flights.json";
const H = 3600e3, FULL_EVERY_H = 12, DAILY_CAP = 95;
const TZ = "Europe/Paris";
if (!KEY) { console.log("Secret AFKL_API_KEY pas encore renseigné : rien à faire."); process.exit(0); }

  const MC_COUNTRIES = new Set(("FR,DE,AT,BE,BG,CY,HR,DK,ES,EE,FI,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,CZ,RO,SK,SI,SE,"+
    "GB,CH,NO,IS,LI,MC,AD,SM,VA,RS,BA,ME,MK,AL,XK,UA,MD,BY,RU,GE,AM,AZ,TR,MA,DZ,TN,LY,EG,IL,LB,JO").split(","));
  function isLongHaul(haul, countryCode){
    const h = String(haul||"").toUpperCase();
    if (/LONG|^LH$|^LC$|^L$/.test(h)) return true;
    if (/MEDIUM|SHORT|^MH$|^SH$|^MC$|^CC$|^M$|^S$/.test(h)) return false;
    if (countryCode) return !MC_COUNTRIES.has(String(countryCode).toUpperCase());
    return false;
  }
  const BRIEF_SOON_MIN = 15;  // pastille « imminent » 15 min avant le début du briefing
  const BRIEF_END_MIN = 8;    // pastille « terminé » 8 min après le début du briefing
  const BRIEF_REMOVE_MIN = 25;    // vue au fil de l'eau : un vol LC quitte le tableau 25 min après la fin du briefing
  const BRIEF_REMOVE_MC_MIN = 15; // … un vol MC, 15 min après
  const removedLive = f => { const b = briefingOf(f); return !!b && Date.now() > b.getTime() + (BRIEF_END_MIN + (f.lc ? BRIEF_REMOVE_MIN : BRIEF_REMOVE_MC_MIN))*60e3; };
  // LC : briefing H−1h30. MC : briefing H−1h10.

  // Type avion court (A220, A321, B772, B77W, B787, A350…)
  const AC_IATA = {"221":"A220","223":"A220","22N":"A220","318":"A318","319":"A319","320":"A320","32N":"A20N","321":"A321","32Q":"A21N",
    "332":"A332","333":"A333","339":"A339","359":"A350","35K":"A35K","351":"A35K","772":"B772","77W":"B77W","773":"B773","788":"B787","789":"B787","78X":"B78X","781":"B78X","E70":"E170","E75":"E175","E90":"E190","E95":"E195"};
  function acShort(code, name){
    const c = String(code||"").toUpperCase().trim();
    if (AC_IATA[c]) return AC_IATA[c];
    if (/^[AB]\d{3}$/.test(c) || /^[AB]\d{2}[A-Z]$/.test(c)) return c;
    const n = String(name||"").toUpperCase();
    let m;
    if (/A ?220|CS ?300|BD-500/.test(n)) return "A220";
    if ((m = n.match(/A ?3(18|19|20|21)/))) return "A3" + m[1];
    if ((m = n.match(/A ?33(0|2|3|9)(-(\d))?/))) return m[3] ? "A33" + m[3] : "A330";
    if (/A ?350/.test(n)) return /1000/.test(n) ? "A35K" : "A350";
    if (/777/.test(n)) return /300|77W/.test(n) ? "B77W" : "B772";
    if (/787/.test(n)) return /10/.test(n.replace(/787/,"")) ? "B78X" : "B787";
    if ((m = n.match(/E(MBRAER)? ?-?(1[79]\d)/))) return "E" + m[2];
    return c.slice(0,4);
  }

  const CITY_FR = {"WARSAW": "Varsovie", "BRUSSELS": "Bruxelles", "LONDON": "Londres", "COPENHAGEN": "Copenhague", "GOTEBORG": "Goteborg", "ATHENS": "Athenes", "LISBON": "Lisbonne", "VIENNA": "Vienne", "VENICE": "Venise", "BARCELONA": "Barcelone", "SEVILLE": "Seville", "ALGIERS": "Alger", "BEIRUT": "Beyrouth", "CAIRO": "Le Caire", "TEL AVIV-YAFO": "Tel Aviv", "BEIJING": "Pekin", "SEOUL": "Seoul", "SINGAPORE": "Singapour", "MEXICO CITY": "Mexico", "PANAMA CITY": "Panama", "CAPE TOWN": "Le Cap", "SAO PAULO": "Sao Paulo", "MAURITIUS": "Maurice", "SAINT DENIS DE LA REUNION": "La Reunion", "POINTE A PITRE": "Pointe-a-Pitre", "ST MAARTEN": "Saint-Martin", "DUESSELDORF": "Dusseldorf", "HANNOVER": "Hanovre", "HAMBURG": "Hambourg", "BASEL/MULHOUSE": "Bale-Mulhouse", "GENEVA": "Geneve", "EDINBURGH": "Edimbourg", "BUCHAREST": "Bucarest", "KRAKOW": "Cracovie", "THESSALONIKI": "Thessalonique", "NAPLES": "Naples", "PALERMO": "Palerme", "CATANIA": "Catane", "BOLOGNA": "Bologne", "GENOA": "Genes", "MOSCOW": "Moscou", "DUBAI": "Dubai", "RIYADH": "Riyad", "JEDDAH": "Djeddah", "MONTREAL": "Montreal", "QUEBEC": "Quebec", "HO CHI MINH CITY": "Ho Chi Minh", "HANOI": "Hanoi", "BOGOTA": "Bogota", "LOME": "Lome", "YAOUNDE": "Yaounde", "NUREMBERG": "Nuremberg", "VALENCIA": "Valence", "FLORENCE": "Florence", "MUNICH": "Munich", "MILAN": "Milan", "TURIN": "Turin", "COLOGNE": "Cologne", "STUTTGART": "Stuttgart", "BERLIN": "Berlin", "DUBLIN": "Dublin", "MANCHESTER": "Manchester", "BIRMINGHAM": "Birmingham", "NEWCASTLE": "Newcastle", "NEW YORK": "New York", "WASHINGTON": "Washington", "SAN FRANCISCO": "San Francisco", "LOS ANGELES": "Los Angeles", "TAHITI": "Papeete", "PHUKET": "Phuket", "DELHI": "Delhi", "MUMBAI": "Bombay", "BENGALURU": "Bangalore", "TOKYO": "Tokyo", "OSAKA": "Osaka", "SHANGHAI": "Shanghai", "HONG KONG": "Hong Kong", "BANGKOK": "Bangkok"};
  // LC/MC selon la flotte : gros-porteur = long-courrier, monocouloir = moyen-courrier
  const WIDEBODY = new Set(["A330","A332","A333","A339","A350","A35K","A380","B772","B77W","B773","B787","B78X"]);
  function classifyLc(acCode, haul, country){
    if (acCode && WIDEBODY.has(acCode)) return true;
    if (acCode && /^(A2|A3[12]|E1|CRJ|AT7|DH)/.test(acCode)) return false;
    return isLongHaul(haul, country);
  }
  const isTrain = ac => /^TRN$/i.test(ac.typeCode||"") || /TRAIN|TGV|RAIL/i.test(ac.typeName||"");
  const cityFr = n => { const k = String(n||"").toUpperCase().trim(); return CITY_FR[k] || n; };
  function afklStatus(code, cancelled, sched, rev){
    const c = (code||"").toUpperCase();
    if (cancelled === "Y" || /CANCEL/.test(c)) return "Canceled";
    if (/DIVERT|RETURN/.test(c)) return "Diverted";
    if (/DEPART|TAKEN|AIRBORNE|IN_FLIGHT|ARRIV|LANDED/.test(c)) return "Departed";
    if (/BOARD/.test(c)) return "Boarding";
    if (/GATE_CLOSED|CLOSED/.test(c)) return "GateClosed";
    if (/DELAY|NEW_DEPARTURE/.test(c) || (rev && sched && rev - sched > 5*60e3)) return "Delayed";
    return "Expected";
  }
  function normalizeAfkl(op){
    const legs = op.flightLegs || [];
    const leg = legs.find(l => l.departureInformation && l.departureInformation.airport && l.departureInformation.airport.code === "CDG") || legs[0];
    if (!leg) return null;
    if (op.airline && op.airline.code && op.airline.code !== "AF") return null;
    const dep = leg.departureInformation || {}, t = dep.times || {}, pl = (dep.airport && dep.airport.places) || {};
    const arr = (leg.arrivalInformation && leg.arrivalInformation.airport) || {};   // destination = escale suivante après CDG
    const sched = t.scheduled ? new Date(t.scheduled) : null;
    const est = t.actual || t.estimatedPublic || t.latestPublished;
    let rev = est ? new Date(est) : null;
    if (rev && sched && Math.abs(rev - sched) < 60e3) rev = null;
    let term = pl.departureTerminal || pl.boardingTerminal || pl.terminalCode || "";
    term = String(term).replace(/^T/i,"");
    if (/^[A-G]$/i.test(term) && pl.aerogareCode) term = pl.aerogareCode + term;
    const statusCode = leg.legStatusPublic || op.flightStatusPublic || "";
    const ac = leg.aircraft || {};
    if (isTrain(ac)) return null;                                   // TGV AIR : pas un vol
    const acCode = acShort(ac.typeCode, ac.typeName);
    return {
      id: op.id || ("AF" + op.flightNumber + op.flightScheduleDate),
      number: "AF " + op.flightNumber,
      dest: cityFr((arr.city && arr.city.name) || arr.name || arr.code || "—"),
      destAirport: arr.name || "", destIata: arr.code || "",
      sched, rev,
      terminal: term,
      gate: (pl.gateNumber && pl.gateNumber[0]) || "",
      checkIn: (pl.checkInZone || []).join(", "),
      status: afklStatus(statusCode, leg.irregularity && leg.irregularity.cancelled, sched, rev),
      statusLabel: leg.legStatusPublicLangTransl || op.flightStatusPublicLangTransl || "",
      lc: classifyLc(acCode, op.haul, arr.city && arr.city.country && arr.city.country.code),
      aircraft: [ac.typeName, ac.registration].filter(Boolean).join(" · "),
      ac: acCode,
      hop: /^A5$/i.test(ac.ownerAirlineCode||"") || /HOP/i.test((ac.cabinCrewEmployer||"") + (ac.ownerAirlineName||"")),
      prevFlight: prevOf(op),
      rotation: isRotation(op)
    };
  }
  // Avion déjà arrivé à CDG le même jour (vol précédent de l'appareil) : équipage possiblement en rotation
  function prevOf(op){
    const p = op.flightRelations && op.flightRelations.previousFlightData;
    return p ? `${p.airlineCode||""}${p.flightNumber||""} du ${p.flightScheduleDate||"?"}` : "";
  }
  function isRotation(op){
    const p = op.flightRelations && op.flightRelations.previousFlightData;
    return !!(p && p.flightScheduleDate && p.flightScheduleDate === op.flightScheduleDate);
  }


const parisHour = d => +new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",hourCycle:"h23"}).format(d);
const parisDay  = d => new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(d);
const isoZ = d => d.toISOString().replace(/\.\d{3}Z$/,"Z");
const sleep = ms => new Promise(r=>setTimeout(r,ms));

let prev = { flights: [], lastFull: 0, calls: {} };
try { prev = { ...prev, ...JSON.parse(fs.readFileSync(OUT, "utf8")) }; } catch {}
const today = parisDay(new Date());
let callsToday = (prev.calls && prev.calls[today]) || 0;

async function page(from, to, n){
  if (callsToday >= DAILY_CAP) throw new Error("Quota du jour atteint");
  const qs = new URLSearchParams({ startRange: isoZ(from), endRange: isoZ(to), movementType:"D", timeOriginType:"S", timeType:"U",
    origin:"CDG", carrierCode:"AF", pageSize:"100", pageNumber:String(n) });
  callsToday++;
  const r = await fetch("https://api.airfranceklm.com/opendata/flightstatus?" + qs,
    { headers: { "API-Key": KEY, "Accept":"application/hal+json", "Accept-Language":"fr-FR" } });
  if (r.status === 204 || r.status === 404) return { flights: [], pages: 1 };
  if (!r.ok) throw new Error(`API Air France-KLM : HTTP ${r.status}`);
  const j = await r.json();
  return { flights: j.operationalFlights || [], pages: (j.page && j.page.totalPages) || 1 };
}
async function range(from, to){
  let all = [], n = 0, pages = 1;
  do { if (n) await sleep(1100); const res = await page(from, to, n); all = all.concat(res.flights); pages = res.pages; n++; }
  while (n < pages && n < 8);
  return all.map(normalizeAfkl).filter(f => f && f.sched);
}

const now = Date.now(), h = parisHour(new Date());
if (h >= 0 && h < 5 && prev.flights.length) { console.log("Pause de nuit"); process.exit(0); }

const full = !prev.flights.length || now - (prev.lastFull || 0) > FULL_EVERY_H * H;
let flights, lastFull = prev.lastFull || 0;
if (full) {
  flights = await range(new Date(now - 0.5*H), new Date(now + 20*H));
  lastFull = now;
} else {
  const fresh = await range(new Date(now - 0.5*H), new Date(now + 3*H));
  const map = new Map(prev.flights.map(f => [f.id, f]));
  fresh.forEach(f => map.set(f.id, f));
  flights = [...map.values()].filter(f => new Date(f.sched).getTime() > now - 2*H);
}
flights.sort((a,b) => new Date(a.sched) - new Date(b.sched));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), lastFull, calls: { [today]: callsToday }, flights }, null, 0));
console.log(`${flights.length} vols écrits (${full ? "complet" : "léger"}), ${callsToday} appels aujourd'hui`);
