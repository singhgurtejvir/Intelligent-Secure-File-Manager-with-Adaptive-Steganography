# Architecture Overview

## Current System Shape

The product now operates as a three-part system:

1. React frontend for the authenticated file-manager shell and vault UI
2. Node.js backend for auth, file APIs, context validation, and ops endpoints
3. Python worker for encryption, carrier analysis, embedding, and extraction

```text
Browser
  -> Frontend (React + Vite)
      -> Backend API (Express)
          -> MongoDB for metadata
          -> RabbitMQ for queue coordination
          -> Redis for supporting infrastructure
          -> Worker API / processing bridge
```

## Frontend Responsibilities

The frontend is no longer just a gallery page. It currently includes:

- Persistent shell layout with navbar, sidebar, toolbar, breadcrumbs, and status bar
- Workspace modes: grid, list, and detail panel
- Search, multi-select, drag-to-move, trash, starring, and inline rename UX
- Full-screen in-app carrier viewer
- Upload studio with folder-aware destination flow
- Authenticated settings, including vault shortcut preference
- Vault trigger logic and device fingerprint collection

Important note:

- Folders, stars, alias names, and some metadata edits are currently frontend-persisted workspace state.

## Backend Responsibilities

The backend owns the secure, server-backed parts of the product:

- User registration, login, and JWT verification
- File upload, list, decrypt, delete, and carrier preview routes
- Context validation and decoy return logic
- Storage metadata and audit logging
- Health and readiness endpoints
- Security headers, request IDs, and rate limiting

## Worker Responsibilities

The worker handles the steganography and crypto-heavy operations:

- AES-256-GCM encryption/decryption support
- PNG LSB embedding and extraction
- JPEG DCT embedding and extraction
- Carrier capacity analysis
- Multi-file shard embedding and extraction
- Visual metric calculation

## Current Upload Flow

```text
1. User starts upload from the workspace or upload page
2. Frontend gathers carrier, payload, password, and optional device context
3. Backend validates MIME type and magic bytes
4. Backend asks worker for capacity analysis
5. Backend embeds into a single carrier or multiple shards
6. If embedding is unavailable, backend can fall back to encrypted sidecar storage
7. Backend stores file metadata and returns the created file record
8. Frontend places the file into the current workspace location
```

## Current View + Decrypt Flow

```text
1. User opens the carrier inline from the workspace
2. Frontend requests the authenticated carrier preview endpoint
3. Backend streams the carrier image inline
4. If the user decrypts, frontend submits password + device context
5. Backend validates context
6. On mismatch, backend returns decoy content metadata
7. On success, backend extracts embedded payload bytes and returns decrypted content
```

## Current Deployment Topology

```text
frontend container/service   : serves React app on port 5173
backend container/service    : serves API on port 3000
worker container/service     : serves steganography service on port 5000
mongodb                      : metadata persistence
rabbitmq                     : queue service
redis                        : supporting infrastructure
```

## Known Architectural Gap

The biggest remaining architectural gap is persistence for file-manager metadata. Today these UX-layer features are frontend-persisted and should move into backend-backed metadata documents:

- folder membership
- starred state
- alias/display name
- trash/restore state
- metadata editor fields

## Health and Ops Notes

The backend now exposes:

- `GET /health`
- `GET /ready`

The Docker Compose stack includes health checks and restart policies for the major services.

**Last Updated:** March 22, 2026
