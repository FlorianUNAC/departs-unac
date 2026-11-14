# Départs Air France · Paris-CDG — Permanence UNAC

Tableau des départs Air France de CDG avec les horaires de briefing PNC, pour les délégués de l'UNAC.

- `index.html` : le tableau (lien à ouvrir sur la TV, un PC ou un téléphone).
- `scripts/fetch-flights.mjs` : le robot qui récupère les vols auprès de l'API Air France-KLM Open Data.
- `.github/workflows/vols.yml` : lance le robot toutes les 30 minutes (pause de 0 h à 5 h, heure de Paris).
- `data/flights.json` : les vols, écrits par le robot et lus par le tableau.

## Compte rendu de la commission hébergement (LC / MC)

- `hebergement/index.html` : générateur du CR mensuel (lien délégués : `florianunac.github.io/departs-unac/hebergement/`). Les délégués saisissent trigramme + texte par zone ; la mise en page A4 (frame UNAC) et la pagination sont automatiques ; bouton « Télécharger le PDF ».
- Import de notes : PDF (texte), Word .docx ou texte collé → trigrammes / noms de villes et textes extraits dans le navigateur (`hebergement/import.js`, bibliothèques pdf.js et mammoth dans `hebergement/vendor/`), avec écran de vérification avant ajout.
- `hebergement/escales.js` : référentiel des escales par zone (LC et MC), à compléter au besoin.
- Visuel de fin facultatif : déposer une photo détourée en `img/pnc-hebergement.png` pour qu'elle apparaisse en bas de la dernière page.

La clé Air France-KLM est stockée dans le secret `AFKL_API_KEY` du dépôt (Settings → Secrets and variables → Actions). Elle n'apparaît ni dans le code ni dans la page.
