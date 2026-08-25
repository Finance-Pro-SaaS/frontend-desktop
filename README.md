# Frontend Desktop — ONG Finance Pro

Application Windows/Linux (Electron), qui embarque le build de `frontend-web` et ajoute l'accès à la base SQLite locale (`better-sqlite3`) pour le mode offline-first.

## Installation

```bash
cd frontend-desktop
npm install
```

## Développement

Deux terminaux :

```bash
# Terminal 1 — sert le frontend web en mode dev
cd frontend-web && npm run dev

# Terminal 2 — lance la fenêtre Electron qui pointe dessus
cd frontend-desktop && npm start
```

## Build de production

```bash
cd frontend-web && npm run build     # génère frontend-web/dist
cd ../frontend-desktop
npm run build:win     # ou build:linux
```

## Rôle de cette couche

- Héberge la base **SQLite locale** (`app/Sync` côté logique, `better-sqlite3` côté accès disque) — voir `../docs/database/sqlite_schema.sql`.
- Expose au frontend web, via `preload.js`, une API sécurisée pour lire/écrire dans SQLite sans donner un accès Node.js complet (`contextIsolation: true`).
- Gère la file de synchronisation (`sync_queue`) et déclenche les appels vers l'API Laravel quand la connexion est disponible.
