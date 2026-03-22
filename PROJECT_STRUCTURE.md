# Project Structure

```text
secure-file-manager/
+-- frontend/
¦   +-- src/
¦   ¦   +-- components/
¦   ¦   ¦   +-- common/            shared primitives such as carrier image rendering
¦   ¦   ¦   +-- editors/           metadata editor surfaces
¦   ¦   ¦   +-- filemanager/       workspace, cards, list, viewer integration
¦   ¦   ¦   +-- layout/            shell layout, sidebar, toolbar, breadcrumbs, status bar
¦   ¦   ¦   +-- viewer/            full-screen carrier viewer
¦   ¦   +-- hooks/                 vault trigger and capacity hooks
¦   ¦   +-- pages/                 Gallery, Upload, Settings, Login, Register
¦   ¦   +-- store/                 auth, vault, workspace, and UI state
¦   ¦   +-- styles/                global visual system and theme rules
¦   ¦   +-- utils/                 API client, fingerprinting, steganography helpers
¦   +-- package.json
¦   +-- vite.config.ts
+-- backend/
¦   +-- src/
¦   ¦   +-- app.ts                 app factory with health/readiness wiring
¦   ¦   +-- server.ts              runtime bootstrap and graceful shutdown
¦   ¦   +-- config/                database connection state
¦   ¦   +-- controllers/           file upload/decrypt/delete logic
¦   ¦   +-- middleware/            auth, rate limiting, security, errors
¦   ¦   +-- models/                user and file schemas
¦   ¦   +-- routes/                auth and file endpoints
¦   ¦   +-- services/              queue and worker integration
¦   ¦   +-- utils/                 crypto, context, upload, storage, audit helpers
¦   +-- package.json
+-- worker/
¦   +-- app.py                     Flask entrypoint
¦   +-- services/                  encryption, analysis, LSB, DCT, shard helpers
¦   +-- tests/                     worker unit tests
¦   +-- requirements.txt
+-- docs/
¦   +-- API.md
¦   +-- ARCHITECTURE.md
¦   +-- DEPLOYMENT.md
¦   +-- STEGANOGRAPHY.md
+-- scripts/
¦   +-- setup.bat
¦   +-- setup.sh
+-- docker-compose.yml
+-- README.md
+-- CHECKLIST.md
+-- package.json
```

## Current Frontend Reality

The frontend is now a file-manager style application rather than a simple gallery. It includes:

- persistent authenticated shell
- folder-aware upload flow
- in-app carrier viewer
- detail panel and metadata editing
- workspace search, selection, trash, and drag-and-drop UX
- configurable vault trigger in authenticated settings

## Current Backend Reality

The backend supports:

- auth and JWT protection
- upload/list/decrypt/delete/carrier preview endpoints
- context-aware decoy behavior
- health/readiness checks
- worker integration for embed/extract/analyze operations

## Remaining Structural Gap

Workspace metadata such as folders, stars, aliases, and trash state are still frontend-persisted and should be moved into backend-backed metadata over the next milestone.

**Last Updated:** March 22, 2026
