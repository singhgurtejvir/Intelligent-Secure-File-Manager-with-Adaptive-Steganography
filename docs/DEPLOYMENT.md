# Deployment Guide

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker and Docker Compose

### Start the stack

```bash
cd "e:\FILE MANAGER"
docker-compose up -d
npm run dev
```

`npm run dev` starts the frontend, backend, and worker together for local development.

### Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Backend health: `http://localhost:3000/health`
- Backend readiness: `http://localhost:3000/ready`
- Worker: `http://localhost:5000`
- RabbitMQ: `http://localhost:15672`

## Docker Compose Notes

The current compose stack includes:

- MongoDB with health checks
- RabbitMQ with health checks
- Redis with health checks
- Backend health check against `/ready`
- Worker health check against `/health`
- Restart policies for the major services

To rebuild and run everything:

```bash
docker-compose up -d --build
```

To inspect logs:

```bash
docker-compose logs -f
```

## Environment Variables

The backend currently expects values like:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://root:rootpassword@mongodb:27017/secure-file-manager?authSource=admin
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
REDIS_URL=redis://redis:6379
WORKER_HOST=worker
WORKER_PORT=5000
JWT_SECRET=change-me-for-production
CORS_ORIGIN=http://localhost:5173
```

## Production Guidance

Before production, plan for these gaps:

- move JWT secrets and connection strings into secret management
- terminate TLS in front of frontend and backend
- add monitoring and centralized logs
- add backup routines for MongoDB and stored carrier files
- add migration/versioning for backend metadata changes

## Validation Commands

The current project can be verified with:

```bash
npm run lint
npm run test
npm run build -w backend
npm run build -w frontend
```

Note: the frontend production build may require elevated execution in restricted Windows sandbox environments because `vite` uses `esbuild`, which needs process spawn permissions.

## Recommended Production Checks

- verify `/health` returns `200`
- verify `/ready` returns `200` only when database and queue are available
- verify worker `/health` returns `200`
- verify upload, carrier preview, decrypt, and delete flows against production storage

## Rollout Priorities

1. Stand up the current Docker-based stack in a staging environment
2. Add observability and alerts
3. Move frontend workspace metadata into backend persistence
4. Add end-to-end smoke tests to deployment pipelines
5. Introduce backups and disaster recovery procedures

**Last Updated:** March 22, 2026
