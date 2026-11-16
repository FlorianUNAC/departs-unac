// Robot ménage — studio La Grande Motte
// Lit le calendrier iCal Airbnb (secret AIRBNB_ICAL_URL, jamais écrit dans le dépôt)
// et écrit data/menage.json : uniquement les dates de séjour (aucune donnée voyageur).
import fs from "node:fs";

const URL_ICAL = process.env.AIRBNB_ICAL_URL;
const OUT = "data/menage.json";
const REFRESH_H = 6; // réécrit le fichier au moins toutes les 6 h (preuve que la synchro tourne)

export function parseIcs(txt) {
  const lines = txt.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events = []; let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") { if (ev) events.push(ev); ev = null; }
    else if (ev) {
      const i = l.indexOf(":"); if (i < 0) continue;
      const key = l.slice(0, i).split(";")[0].toUpperCase(), val = l.slice(i + 1);
      if (key === "DTSTART" || key === "DTEND") { const m = val.match(/^(\d{4})(\d{2})(\d{2})/); if (m) ev[key] = `${m[1]}-${m[2]}-${m[3]}`; }
      else if (key === "SUMMARY") ev.SUMMARY = val.trim();
    }
  }
  return events;
}

const nights = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function buildStays(events, todayIso) {
  const limit = new Date(Date.parse(todayIso) - 30 * 864e5).toISOString().slice(0, 10);
  return events
    .filter(e => e.DTSTART && e.DTEND && !/not available|indisponible|blocked|bloqu/i.test(e.SUMMARY || ""))
    .filter(e => e.DTEND >= limit)
    .map(e => ({ arrivee: e.DTSTART, depart: e.DTEND, nuits: nights(e.DTSTART, e.DTEND) }))
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (!URL_ICAL) { console.log("Secret AIRBNB_ICAL_URL pas encore renseigné : rien à faire."); process.exit(0); }
  const res = await fetch(URL_ICAL, { headers: { "User-Agent": "Mozilla/5.0 (robot menage)" } });
  if (!res.ok) { console.error("Airbnb a répondu " + res.status); process.exit(1); }
  const txt = await res.text();
  if (!txt.includes("BEGIN:VCALENDAR")) { console.error("Réponse Airbnb inattendue (pas un calendrier)"); process.exit(1); }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const sejours = buildStays(parseIcs(txt), today);

  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
  const same = old && JSON.stringify(old.sejours) === JSON.stringify(sejours);
  const fresh = old && Date.now() - Date.parse(old.verifie) < REFRESH_H * 3600e3;
  if (same && fresh) { console.log("Aucun changement."); process.exit(0); }
  const now = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify({ verifie: now, modifie: same ? old.modifie : now, sejours }, null, 1) + "\n");
  console.log(`${sejours.length} séjour(s) écrits.`);
}
