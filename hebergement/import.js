// Import des notes brutes d'un délégué (PDF texte, Word, texte collé) -> escales pré-remplies.
// Aucune donnée ne quitte l'appareil : l'extraction se fait dans le navigateur.
"use strict";
(function(){
  const STOP = new Set(("RAS PNC PNT CDG ORY TSV CSE UNAC SNPNC SNGAF OPS CCP HOT BUS VIP TV OK NOK ETC KLM USA UK SMS PDF RDV DP RH DG CC MEP SST WC RAF MAJ NB PS " +
    "LES DES UNE AUX PAS QUE QUI EST SUR PAR POUR AVEC SANS MAIS DONC CAR OUI NON LUN MAR MER JEU VEN SAM DIM JAN FEV AVR MAI JUI AOU SEP OCT NOV DEC LC MC").split(" "));
  const SEP = "[:\\-–—./)>|]";
  const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

  /* ---------- Référentiel global (LC + MC) ---------- */
  function refAll(){
    const codes = {}, villes = [];
    ["LC","MC"].forEach(t => (ESCALES[t]||[]).forEach(z => Object.entries(z.escales).forEach(([c,v]) => {
      const o = codes[c] || (codes[c] = {ville:v, zones:{}, types:new Set()});
      o.zones[t] = z.zone; o.types.add(t);
      const n = norm(v); villes.push({n, c});
      const first = n.split(" ")[0]; if(first.length >= 4 && first !== n) villes.push({n:first, c, weak:true});
    })));
    // noms les plus longs d'abord ; un nom « faible » ne remplace jamais un nom complet
    const seen = new Set(); const list = [];
    villes.sort((a,b) => (a.weak?1:0)-(b.weak?1:0) || b.n.length - a.n.length).forEach(v => { if(!seen.has(v.n)){ seen.add(v.n); list.push(v); } });
    list.sort((a,b) => b.n.length - a.n.length);
    const zones = new Set(); ["LC","MC"].forEach(t => (ESCALES[t]||[]).forEach(z => zones.add(norm(z.zone))));
    ["afrique","asie","europe","amerique","amerique du nord","amerique du sud","amerique latine","moyen orient","caraibes","ocean indien","antilles","france","domestique","long courrier","moyen courrier","europe du nord","europe du sud"].forEach(z => zones.add(z));
    return {codes, villes:list, zones};
  }

  /* ---------- Extraction du texte ---------- */
  const loaded = {};
  function loadScript(src){ return loaded[src] || (loaded[src] = new Promise((ok,ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Chargement impossible : "+src)); document.head.appendChild(s); })); }

  async function textFromFile(file){
    const name = file.name.toLowerCase();
    if(name.endsWith(".pdf") || file.type === "application/pdf"){
      await loadScript("vendor/pdf.min.js");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
      let out = "";
      for(let p = 1; p <= pdf.numPages; p++){
        const tc = await (await pdf.getPage(p)).getTextContent();
        let lastY = null, line = "";
        tc.items.forEach(it => {
          const y = it.transform ? it.transform[5] : lastY;
          if(lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()){ out += line + "\n"; line = ""; }
          line += it.str; if(it.hasEOL){ out += line + "\n"; line = ""; }
          lastY = y;
        });
        if(line.trim()) out += line + "\n";
        out += "\n";
      }
      return out;
    }
    if(name.endsWith(".docx")){
      await loadScript("vendor/mammoth.browser.min.js");
      return (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
    }
    return await file.text();
  }

  /* ---------- Analyse ---------- */
  function parse(text){
    const R = refAll();
    const lines = text.replace(/\u00a0/g," ").split(/\r?\n/).map(l => l.replace(/[ \t]+/g," ").trim());
    const entries = new Map(); const order = [];
    let cur = null, zoneHint = null; const pre = [];

    const isKnown = c => !!R.codes[c];
    const okCode = (raw, hasSep) => {
      const c = raw.toUpperCase();
      if(STOP.has(c)) return null;
      if(isKnown(c) && (raw === c || hasSep)) return c;          // connu : majuscules, ou minuscules suivies de « : »
      if(raw === c && hasSep && /^[A-Z]{3}$/.test(c)) return c;  // inconnu : seulement en majuscules suivies de « : »
      return null;
    };
    const stripCity = (code, rest) => {
      const r = R.codes[code]; if(!r) return rest;
      let s = rest.replace(/^\(([^)]*)\)\s*/, (m, inside) => norm(inside).startsWith(norm(r.ville).split(" ")[0]) ? "" : m);
      const words = s.split(" "); const nv = norm(r.ville).split(" ");
      const head = norm(words.slice(0, nv.length).join(" "));
      if(head === nv.join(" ")) s = words.slice(nv.length).join(" ");
      else if(norm(words[0]||"") === nv[0] && nv[0].length >= 4) s = words.slice(1).join(" ");
      return s.replace(new RegExp("^\\s*"+SEP+"+\\s*"), "").trim();
    };
    const open = (code, txt) => {
      let e = entries.get(code);
      if(!e){ e = {code, parts:[], zoneHint}; entries.set(code, e); order.push(code); }
      else e.parts.push("");
      cur = e; if(txt) e.parts.push(txt);
    };
    const push = (txt, bullet) => {
      if(!txt) return;
      if(cur){ if(bullet || !cur.parts.length) cur.parts.push(txt); else cur.parts[cur.parts.length-1] += (cur.parts[cur.parts.length-1] ? " " : "") + txt; }
      else pre.push(txt);
    };
    // Découpe des repères en milieu de ligne : « … ABJ : texte. DSS - texte »
    const MID = new RegExp("(^|[\\s.;,])([A-Z]{3})\\s*" + SEP + "\\s", "g");
    const midSplit = s => {
      const out = []; let last = 0, m; MID.lastIndex = 0;
      while((m = MID.exec(s))){
        if(!isKnown(m[2]) || STOP.has(m[2])) continue;
        const at = m.index + m[1].length;
        out.push({code:null, text:s.slice(last, at)});
        out.push({code:m[2], start:m.index + m[0].length});
        last = m.index + m[0].length;
      }
      if(!out.length) return [{code:null, text:s}];
      out.push({code:null, text:s.slice(last)});
      // regrouper : chaque code prend le texte qui le suit
      const res = []; let pending = null;
      out.forEach(o => { if(o.code){ pending = {code:o.code, text:""}; res.push(pending); } else if(pending){ pending.text += o.text; pending = null; } else res.push({code:null, text:o.text}); });
      return res;
    };

    for(const raw of lines){
      if(!raw){ continue; }
      const bullet = /^[-•*▪–—·>]\s/.test(raw);
      let line = raw.replace(/^[-•*▪–—·>]+\s*/, "");
      const nl = norm(line);
      // Titre de zone
      if(nl.length < 45 && R.zones.has(nl.replace(/ (lc|mc)$/,""))){ zoneHint = line.replace(/\s*[:\-–—]\s*$/,""); cur = null; continue; }
      // Repère en début de ligne : code
      let m = line.match(new RegExp("^\\(?([A-Za-z]{3})\\)?(?=$|[\\s:\\-–—./)>|])\\s*(" + SEP + "?)\\s*(.*)$"));
      let code = m && okCode(m[1], !!m[2] || !m[3]);
      if(code && m[3] === "" && !isKnown(code) && !m[2]) code = null;
      if(code){
        const rest = stripCity(code, m[3]);
        const parts = midSplit(rest);
        open(code, (parts[0].code ? "" : parts[0].text).trim());
        parts.slice(parts[0].code ? 0 : 1).forEach(p => p.code ? open(p.code, p.text.trim()) : push(p.text.trim()));
        continue;
      }
      // Repère en début de ligne : nom de ville (« Johannesburg : … », ou ville seule en titre)
      const hit = R.villes.find(v => nl === v.n || nl.startsWith(v.n + " "));
      if(hit){
        const words = line.split(" "); const k = hit.n.split(" ").length;
        let rest = words.slice(k).join(" ").replace(/^\(?[A-Za-z]{3}\)?\s*(?=[:\-–—]|$)/, "").replace(new RegExp("^\\s*" + SEP + "+\\s*"), "").trim();
        if(nl === hit.n || /^[:\-–—]/.test(words.slice(k).join(" ").trim()) || /^\([A-Za-z]{3}\)/.test(words.slice(k).join(" ").trim())){
          const parts = midSplit(rest);
          open(hit.c, (parts[0].code ? "" : parts[0].text).trim());
          parts.slice(parts[0].code ? 0 : 1).forEach(p => p.code ? open(p.code, p.text.trim()) : push(p.text.trim()));
          continue;
        }
      }
      // Ligne de texte (éventuellement avec repères internes)
      midSplit(line).forEach((p, i) => p.code ? open(p.code, p.text.trim()) : push(p.text.trim(), i === 0 && bullet));
    }

    const clean = t => t.replace(/\s+([.,;:!?])/g, "$1").replace(/^[\s:\-–—.]+/, "").trim();
    const list = order.map(c => { const e = entries.get(c); return {code:c, texte:e.parts.map(clean).filter(Boolean).join("\n"), zoneHint:e.zoneHint}; });
    // Type probable
    let lc = 0, mc = 0;
    list.forEach(e => { const r = R.codes[e.code]; if(!r) return; if(r.types.has("LC") && !r.types.has("MC")) lc++; if(r.types.has("MC") && !r.types.has("LC")) mc++; });
    const guess = lc === mc ? type : (lc > mc ? "LC" : "MC");
    return {list, preambule: pre.join("\n").trim(), guess, R};
  }

  /* ---------- Fenêtre ---------- */
  const M = document.createElement("div");
  M.className = "modal"; M.id = "importModal";
  M.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-labelledby="impTitle">
    <div class="mhead"><h3 id="impTitle">Importer des notes de délégué</h3><button class="mclose" data-x aria-label="Fermer">×</button></div>
    <div class="mbody" id="impBody"></div>
    <div class="mfoot" id="impFoot"></div></div>`;
  document.body.appendChild(M);
  const body = M.querySelector("#impBody"), foot = M.querySelector("#impFoot");
  M.addEventListener("click", e => { if(e.target === M || e.target.hasAttribute("data-x")) close(); });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && M.classList.contains("on")) close(); });
  function close(){ M.classList.remove("on"); }
  let result = null;

  function step1(msg){
    result = null;
    body.innerHTML = `
      <p class="mintro">Déposez la prise de notes telle quelle : l'outil repère les trigrammes (ou les noms de villes) et le texte qui suit, puis vous montre ce qu'il a compris avant de l'ajouter. Rien n'est envoyé sur Internet.</p>
      <label class="drop" id="drop"><input type="file" id="impFile" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6M9 14l3-3 3 3"/></svg>
        <b>Choisir ou glisser un fichier</b><span>PDF (texte), Word .docx ou .txt</span></label>
      <div class="or">ou collez le texte des notes</div>
      <textarea id="impText" rows="9" placeholder="ABJ : hôtel ok, chambres rénovées au 4e&#10;DSS - travaux de façade, bruit en journée&#10;Johannesburg : transfert à surveiller…"></textarea>
      ${msg ? `<p class="merr">${msg}</p>` : ""}`;
    foot.innerHTML = `<span></span><div style="display:flex;gap:8px"><button class="mbtn" data-x>Annuler</button><button class="mbtn pri" id="impGo">Analyser</button></div>`;
    const drop = body.querySelector("#drop");
    ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("hov"); }));
    ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("hov"); }));
    drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if(f) fromFile(f); });
    body.querySelector("#impFile").addEventListener("change", e => { const f = e.target.files[0]; if(f) fromFile(f); });
    foot.querySelector("#impGo").addEventListener("click", () => {
      const t = body.querySelector("#impText").value; if(!t.trim()) return toast("Collez du texte ou choisissez un fichier");
      analyse(t, "texte collé");
    });
  }

  async function fromFile(f){
    body.innerHTML = `<p class="mintro">Lecture de « ${esc(f.name)} »…</p>`; foot.innerHTML = "";
    try{
      const t = await textFromFile(f);
      if(t.replace(/\s/g,"").length < 15) return step1("Ce fichier ne contient pas de texte lisible (PDF scanné ou photo). Ouvrez-le, copiez le texte et collez-le ci-dessous, ou exportez-le en PDF « texte » depuis Word / Notes.");
      analyse(t, f.name);
    }catch(e){ step1("Lecture impossible : " + esc(e.message || e)); }
  }

  function analyse(text, source){
    result = parse(text);
    if(!result.list.length) return step1("Aucun trigramme ni nom d'escale reconnu dans « " + esc(source) + " ». Vérifiez que chaque escale commence par son trigramme (ex. « ABJ : … ») ou le nom de la ville.");
    result.target = result.guess; result.source = source;
    step2();
  }

  function zoneFor(e, t){
    const r = result.R.codes[e.code];
    if(r && r.zones[t]) return r.zones[t];
    const zs = zonesOf(t);
    if(e.zoneHint){ const h = norm(e.zoneHint); const z = zs.find(n => norm(n) === h || norm(n).startsWith(h) || h.startsWith(norm(n))); if(z) return z; }
    return zs[0] || "";
  }
  function zonesOf(t){
    const d = t === type ? S.zones.map(z => z.nom) : (ESCALES[t]||[]).map(z => z.zone);
    return [...new Set(d)];
  }

  function step2(){
    const t = result.target, zs = zonesOf(t);
    const curTexts = {}; if(t === type) S.zones.forEach(z => z.escales.forEach(e => { if(e.code && e.texte.trim()) curTexts[e.code] = 1; }));
    const nbExist = result.list.filter(e => curTexts[e.code]).length;
    body.innerHTML = `
      <div class="mbar">
        <div><b>${result.list.length} escale${result.list.length>1?"s":""}</b> détectée${result.list.length>1?"s":""} dans « ${esc(result.source)} »</div>
        <label>Compte rendu : <select id="impType"><option value="LC" ${t==="LC"?"selected":""}>LC</option><option value="MC" ${t==="MC"?"selected":""}>MC</option></select></label>
      </div>
      ${nbExist ? `<div class="mbar"><span>${nbExist} escale${nbExist>1?"s ont":" a"} déjà un texte dans le CR ${t}.</span><label>Dans ce cas : <select id="impMode"><option value="append">ajouter à la suite</option><option value="replace">remplacer</option></select></label></div>` : ""}
      ${result.preambule ? `<div class="pre"><label class="chk"><input type="checkbox" id="impPre"> Utiliser le début des notes (avant la 1re escale) pour « À noter »</label><textarea id="impPreTx" rows="3">${esc(result.preambule)}</textarea></div>` : ""}
      <div class="ilist">${result.list.map((e,i) => {
        const r = result.R.codes[e.code], z = zoneFor(e, t);
        return `<div class="irow" data-i="${i}">
          <input type="checkbox" class="ion" checked aria-label="Importer">
          <div class="icode"><input type="text" class="icd" value="${esc(e.code)}" maxlength="4"><small>${r ? esc(r.ville) : "hors référentiel"}${curTexts[e.code] ? " · <i>déjà saisi</i>" : ""}</small></div>
          <div class="ibody"><select class="iz">${zs.map(n => `<option ${n===z?"selected":""}>${esc(n)}</option>`).join("")}</select><textarea class="itx" rows="2">${esc(e.texte)}</textarea></div>
        </div>`; }).join("")}</div>`;
    foot.innerHTML = `<button class="mbtn" id="impBack">← Autre document</button><div style="display:flex;gap:8px"><button class="mbtn" data-x>Annuler</button><button class="mbtn pri" id="impOk">Ajouter au compte rendu</button></div>`;
    body.querySelector("#impType").addEventListener("change", e => { collect(); result.target = e.target.value; step2(); });
    body.querySelectorAll(".icd").forEach(inp => inp.addEventListener("input", () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,""); }));
    foot.querySelector("#impBack").addEventListener("click", () => step1());
    foot.querySelector("#impOk").addEventListener("click", apply);
  }
  function collect(){
    body.querySelectorAll(".irow").forEach(row => { const e = result.list[+row.dataset.i]; e.code = row.querySelector(".icd").value; e.texte = row.querySelector(".itx").value; e.on = row.querySelector(".ion").checked; e.zoneSel = row.querySelector(".iz").value; });
    const p = body.querySelector("#impPreTx"); if(p) result.preambule = p.value;
  }

  function apply(){
    collect();
    const mode = (body.querySelector("#impMode")||{}).value || "append";
    const usePre = body.querySelector("#impPre") && body.querySelector("#impPre").checked;
    if(result.target !== type) setType(result.target);
    let n = 0;
    result.list.forEach(e => {
      if(e.on === false || !e.code) return;
      let zone = S.zones.find(z => z.nom === e.zoneSel);
      if(!zone){ zone = {id:uid(), nom:e.zoneSel || "Autres escales", open:true, escales:[]}; S.zones.push(zone); }
      let found = null; S.zones.forEach(z => z.escales.forEach(x => { if(x.code === e.code) found = x; }));
      if(found){
        const tx = e.texte.trim();
        if(!found.texte.trim() || mode === "replace") found.texte = tx;
        else if(tx && !found.texte.includes(tx)) found.texte = found.texte.trim() + "\n" + tx;
      } else zone.escales.push({id:uid(), code:e.code, texte:e.texte.trim()});
      zone.open = true; n++;
    });
    if(usePre && result.preambule.trim()) S.aNoter = S.aNoter.trim() ? S.aNoter.trim() + "\n" + result.preambule.trim() : result.preambule.trim();
    changed(true); close();
    toast(`${n} escale${n>1?"s":""} importée${n>1?"s":""} dans le CR ${type} — à relire avant le PDF`);
  }

  window.openImport = () => { step1(); M.classList.add("on"); };
  window.__parseNotes = parse; // tests
})();
