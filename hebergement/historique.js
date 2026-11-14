// Historique des comptes rendus : brouillons (sur l'appareil) et publiés (sur l'appareil + partagés via GitHub).
"use strict";
(function(){
  const GH_REPO = (() => {
    if(location.hostname.endsWith(".github.io")) return location.hostname.split(".")[0] + "/" + location.pathname.split("/")[1];
    return "FlorianUNAC/departs-unac";
  })();
  const TOKEN_KEY = "crheb:ghtoken";
  let SHARED = [];
  const token = () => localStorage.getItem(TOKEN_KEY) || "";
  const fmt = ts => ts ? new Date(ts).toLocaleDateString("fr-FR") + " à " + new Date(ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "";
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- CR publiés partagés (dossier publies/ du site) ---------- */
  window.loadShared = async function(){
    try{ const r = await fetch("publies/index.json", {cache:"no-store"}); if(r.ok){ const j = await r.json(); if(Array.isArray(j)) SHARED = j; } }catch(e){}
    if(M.classList.contains("on")) render();
  };

  /* ---------- API GitHub (publication pour tous, réservée à l'administrateur) ---------- */
  const b64enc = s => btoa(unescape(encodeURIComponent(s)));
  const b64dec = s => decodeURIComponent(escape(atob(s.replace(/\n/g,""))));
  async function gh(path, opt){
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, Object.assign({
      headers:{"Authorization":"Bearer " + token(), "Accept":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}}, opt||{}));
    if(r.status === 404 && (!opt || opt.method !== "PUT")) return null;
    if(r.status === 401) throw new Error("jeton refusé (expiré ou incorrect)");
    if(r.status === 403 || r.status === 404) throw new Error("ce jeton n'a pas le droit d'écrire dans le dépôt " + GH_REPO);
    if(!r.ok) throw new Error("GitHub a répondu " + r.status);
    return r.json();
  }
  async function ghRead(path){ const j = await gh(path + "?ref=main"); return j ? {sha:j.sha, text:b64dec(j.content)} : null; }
  async function ghWrite(path, text, message, sha){
    return gh(path, {method:"PUT", body:JSON.stringify({message, content:b64enc(text), branch:"main", sha})});
  }
  async function pushShared(d){
    const data = Object.assign(exportable(d), {id:d.id, statut:"publie", publieLe:d.publieLe});
    const fichier = `${d.type}-${d.mois}-${d.id}.json`;
    await ghWrite("hebergement/publies/" + fichier, JSON.stringify(data, null, 1), `CR hébergement ${d.type} ${moisLabel(d.mois)} publié`);
    for(let essai = 0; essai < 2; essai++){
      try{
        const idx = await ghRead("hebergement/publies/index.json");
        let list = idx ? JSON.parse(idx.text) : [];
        list = list.filter(x => !(x.type === d.type && x.mois === d.mois) && x.id !== d.id);
        list.push({id:d.id, type:d.type, mois:d.mois, publieLe:d.publieLe, escales:nbEscales(d), fichier});
        list.sort((a,b) => b.mois.localeCompare(a.mois) || a.type.localeCompare(b.type));
        await ghWrite("hebergement/publies/index.json", JSON.stringify(list, null, 1), "Index des CR hébergement publiés", idx && idx.sha);
        SHARED = list; break;
      }catch(e){ if(essai) throw e; }
    }
    d.partage = true; DOCS[d.id] = d; persist();
  }

  /* ---------- Publier ---------- */
  window.publishCR = async function(){
    if(S.statut === "publie") return toast("Ce compte rendu est déjà publié");
    const n = nbEscales(S);
    if(!n) return toast("Rien à publier : aucune escale renseignée");
    const dejaPub = Object.values(DOCS).find(d => d.statut === "publie" && d.type === S.type && d.mois === S.mois);
    const msg = `Publier le compte rendu ${S.type} de ${moisLabel(S.mois)} (${n} escale${n>1?"s":""}) ?\n\n` +
      (dejaPub ? `Il remplacera la version publiée le ${fmt(dejaPub.publieLe)} pour ce mois.\n\n` : "") +
      "Il passera dans les CR publiés et ne sera plus modifiable (vous pourrez toujours en faire un nouveau brouillon)." +
      (token() ? "\n\nIl sera visible par tous les délégués." : "");
    if(!confirm(msg)) return;
    S.statut = "publie"; S.publieLe = Date.now(); DOCS[S.id] = S; persist();
    refreshAll();
    if(token()){
      toast("Publication pour tous en cours…");
      try{ await pushShared(S); refreshAll(); toast("Publié pour tous les délégués (en ligne d'ici 1 à 2 min)"); }
      catch(e){ toast("Publié sur cet appareil seulement : " + e.message); }
    } else toast(`CR ${S.type} ${moisLabel(S.mois)} publié`);
  };

  /* ---------- Fenêtre Historique ---------- */
  const M = document.createElement("div");
  M.className = "modal"; M.id = "histModal";
  M.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-labelledby="hTitle">
    <div class="mhead"><h3 id="hTitle">Historique des comptes rendus</h3><button class="mclose" data-x aria-label="Fermer">×</button></div>
    <div class="mbody" id="hBody"></div>
    <div class="mfoot"><button class="mbtn" id="hNew">+ Nouveau compte rendu</button><button class="mbtn pri" data-x>Fermer</button></div></div>`;
  document.body.appendChild(M);
  const body = M.querySelector("#hBody");
  let onglet = "brouillons", filtre = "tous";
  M.addEventListener("click", e => { if(e.target === M || e.target.hasAttribute("data-x")) M.classList.remove("on"); });
  document.addEventListener("keydown", e => { if(e.key === "Escape") M.classList.remove("on"); });
  M.querySelector("#hNew").addEventListener("click", () => { M.classList.remove("on"); openDoc(newDoc(type)); toast(`Nouveau compte rendu ${type} vierge`); });

  window.openHistory = function(tab){
    if(tab) onglet = tab;
    else onglet = S.statut === "publie" ? "publies" : "brouillons";
    persist(); render(); M.classList.add("on"); loadShared();
  };

  function rows(){
    const local = Object.values(DOCS).filter(d => hasContent(d) || d.id === S.id);
    let list;
    if(onglet === "brouillons"){
      list = local.filter(d => d.statut === "brouillon").map(d => ({d, src:"local"})).sort((a,b) => b.d.maj - a.d.maj);
    } else {
      const map = new Map();
      local.filter(d => d.statut === "publie").forEach(d => map.set(d.id, {d, src:d.partage ? "both" : "local"}));
      SHARED.forEach(x => { if(map.has(x.id)) map.get(x.id).src = "both"; else map.set(x.id, {x, src:"shared"}); });
      list = [...map.values()].sort((a,b) => {
        const A = a.d || a.x, B = b.d || b.x;
        return B.mois.localeCompare(A.mois) || A.type.localeCompare(B.type) || (B.publieLe||0) - (A.publieLe||0);
      });
    }
    if(filtre !== "tous") list = list.filter(r => (r.d || r.x).type === filtre);
    return list;
  }

  function render(){
    const nbB = Object.values(DOCS).filter(d => d.statut === "brouillon" && (hasContent(d) || d.id === S.id)).length;
    const pubIds = new Set(Object.values(DOCS).filter(d => d.statut === "publie").map(d => d.id)); SHARED.forEach(x => pubIds.add(x.id));
    const list = rows();
    let h = `<div class="htabs">
      <button data-tab="brouillons" class="${onglet==="brouillons"?"on":""}">Brouillons (${nbB})</button>
      <button data-tab="publies" class="${onglet==="publies"?"on":""}">Publiés (${pubIds.size})</button>
      <span class="gap"></span>
      <span class="flt htabs" style="margin:0">${["tous","LC","MC"].map(f => `<button data-f="${f}" class="${filtre===f?"on":""}">${f==="tous"?"Tous":f}</button>`).join("")}</span>
    </div><div class="hlist">`;
    if(!list.length) h += `<div class="hempty">${onglet === "brouillons" ? "Aucun brouillon." : "Aucun compte rendu publié pour le moment."}</div>`;
    list.forEach(r => {
      const o = r.d || r.x, isCur = r.d && r.d.id === S.id;
      const n = r.d ? nbEscales(r.d) : (o.escales || 0);
      let info, tags = "", acts = "";
      if(onglet === "brouillons"){
        info = `${n} escale${n>1?"s":""} · modifié le ${fmt(o.maj)}`;
        if(isCur) tags += `<span class="tag cur">ouvert</span>`;
        acts = `${isCur ? "" : `<button class="mini" data-a="open">Ouvrir</button>`}<button class="mini" data-a="dup">Dupliquer</button><button class="mini danger" data-a="del">Supprimer</button>`;
      } else {
        info = `${n} escale${n>1?"s":""} · publié le ${fmt(o.publieLe)}`;
        tags += r.src === "local" ? `<span class="tag">sur cet appareil</span>` : `<span class="tag all">tous les délégués</span>`;
        if(isCur) tags += `<span class="tag cur">ouvert</span>`;
        acts = `${isCur ? "" : `<button class="mini" data-a="open">Consulter</button>`}<button class="mini" data-a="draft">Nouveau brouillon</button>` +
          (r.src === "local" && token() ? `<button class="mini" data-a="share">Publier pour tous</button>` : "") +
          (r.d && r.src === "local" ? `<button class="mini danger" data-a="del">Supprimer</button>` : "");
      }
      h += `<div class="hrow ${isCur?"cur":""}" data-id="${esc(o.id)}" data-src="${r.src}">
        <div class="tb ${o.type==="MC"?"mc":""}">${esc(o.type)}</div>
        <div class="hi"><b>${esc(cap(moisLabel(o.mois)))}${tags}</b><span>${info}</span></div>
        <div class="ha">${acts}</div></div>`;
    });
    h += `</div>
    <details class="ghset"><summary>Publication pour tous les délégués ${token() ? "· activée sur cet appareil" : "· non configurée"}</summary>
      <p>Sans réglage, un CR publié reste dans l'historique de l'appareil qui l'a publié. Pour qu'il apparaisse dans l'historique de tous les délégués, l'administrateur (compte GitHub ${esc(GH_REPO.split("/")[0])}) colle ici un jeton GitHub ayant le droit d'écrire dans le dépôt ${esc(GH_REPO)}. Le jeton reste uniquement sur cet appareil.</p>
      ${token() ? `<div class="ghrow"><button class="mini danger" id="ghOff">Retirer le jeton de cet appareil</button></div>`
        : `<div class="ghrow"><input type="text" id="ghTok" placeholder="github_pat_…" autocomplete="off" spellcheck="false"><button class="mini" id="ghOn">Enregistrer</button></div>`}
    </details>`;
    body.innerHTML = h;
  }

  body.addEventListener("click", async e => {
    const tb = e.target.closest("[data-tab]"); if(tb){ onglet = tb.dataset.tab; return render(); }
    const fb = e.target.closest("[data-f]"); if(fb){ filtre = fb.dataset.f; return render(); }
    if(e.target.id === "ghOn"){
      const v = body.querySelector("#ghTok").value.trim(); if(!v) return;
      localStorage.setItem(TOKEN_KEY, v);
      try{ await gh("hebergement/index.html?ref=main"); toast("Jeton vérifié : publication pour tous activée"); }
      catch(err){ localStorage.removeItem(TOKEN_KEY); toast("Jeton non valide : " + err.message); }
      return render();
    }
    if(e.target.id === "ghOff"){ localStorage.removeItem(TOKEN_KEY); toast("Jeton retiré de cet appareil"); return render(); }
    const b = e.target.closest("[data-a]"); if(!b) return;
    const row = b.closest(".hrow"), id = row.dataset.id, src = row.dataset.src;
    const d = DOCS[id], act = b.dataset.a;
    if(act === "open"){
      if(d){ M.classList.remove("on"); return openDoc(d); }
      const x = SHARED.find(s => s.id === id); if(!x) return;
      try{
        const r = await fetch("publies/" + x.fichier, {cache:"no-store"}); if(!r.ok) throw 0;
        const o = await r.json();
        const doc = fixIds(Object.assign(blank(o.type || x.type), o, {id:x.id, statut:"publie", partage:true, publieLe:o.publieLe || x.publieLe, cree:o.publieLe || Date.now(), maj:o.publieLe || Date.now()}));
        M.classList.remove("on"); openDoc(doc);
      }catch(err){ toast("Impossible d'ouvrir ce compte rendu"); }
      return;
    }
    if(act === "dup" && d){ M.classList.remove("on"); return copyToDraft(d); }
    if(act === "draft"){
      if(d){ M.classList.remove("on"); return copyToDraft(d); }
      const x = SHARED.find(s => s.id === id);
      try{ const o = await (await fetch("publies/" + x.fichier, {cache:"no-store"})).json(); M.classList.remove("on"); copyToDraft(Object.assign(blank(o.type), o)); }
      catch(err){ toast("Impossible de récupérer ce compte rendu"); }
      return;
    }
    if(act === "del" && d){
      if(!confirm(`Supprimer définitivement le ${d.statut === "publie" ? "CR publié" : "brouillon"} ${d.type} de ${moisLabel(d.mois)} de cet appareil ?`)) return;
      delete DOCS[id];
      if(S.id === id){ S = latestDraft(type) || newDoc(type); DOCS[S.id] = S; refreshAll(); }
      persist(); return render();
    }
    if(act === "share" && d){
      b.disabled = true; b.textContent = "Envoi…";
      try{ await pushShared(d); toast("Publié pour tous les délégués (en ligne d'ici 1 à 2 min)"); }
      catch(err){ toast("Échec : " + err.message); }
      if(S.id === d.id) refreshAll();
      return render();
    }
  });
})();
