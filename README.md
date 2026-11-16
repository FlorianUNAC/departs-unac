# Départs Air France · Paris-CDG — Permanence UNAC

Tableau des départs Air France de CDG avec les horaires de briefing PNC, pour les délégués de l'UNAC.

- `index.html` : le tableau (lien à ouvrir sur la TV, un PC ou un téléphone).
- `scripts/fetch-flights.mjs` : le robot qui récupère les vols auprès de l'API Air France-KLM Open Data.
- `.github/workflows/vols.yml` : lance le robot toutes les 30 minutes (pause de 0 h à 5 h, heure de Paris).
- `data/flights.json` : les vols, écrits par le robot et lus par le tableau.

Le générateur du compte rendu de la commission hébergement a été déplacé dans le dépôt `atelier-unac` (florianunac.github.io/atelier-unac/) ; `hebergement/` ne contient plus qu'une redirection.

La clé Air France-KLM est stockée dans le secret `AFKL_API_KEY` du dépôt (Settings → Secrets and variables → Actions). Elle n'apparaît ni dans le code ni dans la page.
