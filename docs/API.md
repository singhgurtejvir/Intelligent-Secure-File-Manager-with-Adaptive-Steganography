# API Documentation

## Base URL
```
Development: http://localhost:3000
Production: https://api.example.com
```

## Authentication
All endpoints (except `/auth`) require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response (201):**
```json
{
  "userId": "user_id_uuid",
  "email": "user@example.com",
  "recoveryKey": "EMERGENCY_KEY_12345678",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "userId": "user_id_uuid",
  "email": "user@example.com"
}
```

---

## File Endpoints

### List Files
```http
GET /api/files
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
[
  {
    "id": "file_id_uuid",
    "name": "secret.pdf",
    "type": "document",
    "carrierMimeType": "image/png",
    "carrierSize": 5242880,
    "originalPayloadName": "secret.pdf",
    "originalPayloadSize": 1024000,
    "storageMode": "embedded",
    "steganographyMethod": "multi-file",
    "capacityUsedPercent": 43.2,
    "shardCount": 3,
    "createdAt": "2026-03-07T10:00:00Z"
  }
]
```

### Upload File
```http
POST /api/files/upload
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

Form Data:
- carrier: <PNG/JPEG file>
- payload: <File to encrypt>
- password: Encryption password (minimum 8 characters)
- context: {JSON} Device context for recovery
```

**Request Example with curl:**
```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
-F "carrier=@carrier.png" \
-F "payload=@secret.pdf" \
-F "password=mypassword" \
 -F 'context={"deviceFingerprint":"fp_123456","timezone":"UTC-5","language":"en-US"}'
```

**Response (201):**
```json
{
  "_id": "file_id_uuid",
  "name": "secret.pdf",
  "type": "document",
  "carrierPath": "1711106400000-cover.png",
  "steganographyMethod": "multi-file",
  "metadata": {
    "originalPayloadName": "secret.pdf",
    "originalPayloadSize": 1024000,
    "originalPayloadMimeType": "application/pdf",
    "encryptionAlgorithm": "AES-256-GCM",
    "analysisCapacityBytes": 350000,
    "capacityUsedPercent": 43.2,
    "distribution": {
      "shardCount": 3,
      "shardMethod": "lsb"
    },
    "visualMetrics": {
      "mse": 0.12,
      "psnr": 57.34,
      "ssim": 0.998
    }
  },
  "createdAt": "2026-03-07T10:00:00Z"
}
```

### Decrypt & Extract File
```http
POST /api/files/:id/decrypt
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "password": "encryption-password",
  "context": {
    "deviceFingerprint": "fp_123456",
    "timezone": "UTC-5"
  }
}
```

**Response (200):**
- Returns the decrypted file as binary blob
- Content-Type: `application/octet-stream`

```bash
# Example: Download decrypted file
curl -X POST http://localhost:3000/api/files/abc123/decrypt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"secret","context":{"deviceFingerprint":"fp_123"}}' \
  --output decrypted_file.pdf
```

**Response (403) - Wrong Context:**
```json
{
  "error": "Access denied - context mismatch",
  "decoyContent": "generic_image.png",
  "status": 403
}
```

(Returns innocent decoy file instead of actual secret)

### Delete File
```http
DELETE /api/files/:id
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "message": "File deleted successfully",
  "id": "file_id_uuid"
}
```

---

## Worker Endpoints

### Embed Payload (LSB)
```http
POST /worker/embed/lsb
Content-Type: multipart/form-data

Form Data:
- carrier: <PNG image>
- payload: <Encrypted payload binary>
- color_bits: [optional, default: 2] Number of LSBs per channel
```

**Response (200):**
```json
{
  "method": "lsb",
  "status": "success",
  "carrier_size": 5242880,
  "payload_size": 524288,
  "capacity_used_percent": 10.0
}
```

### Embed Payload (DCT)
```http
POST /worker/embed/dct
Content-Type: multipart/form-data

Form Data:
- carrier: <JPEG image>
- payload: <Encrypted payload binary>
- quality: [optional, default: 85] JPEG quality factor
```

**Response (200):**
```json
{
  "method": "dct",
  "status": "success",
  "carrier_size": 5242880,
  "payload_size": 1048576,
  "quality": 85,
  "capacity_used_percent": 20.0
}
```

### Extract Payload
```http
POST /worker/extract
Content-Type: multipart/form-data

Form Data:
- carrier: <Carrier image with embedded payload>
- method: "lsb" or "dct"
- payload_size: Expected size of encrypted payload
```

**Response (200):**
```json
{
  "method": "lsb",
  "status": "success",
  "payload_size": 524288,
  "extraction_time_ms": 234
}
```

### Analyze Carrier Capacity
```http
POST /worker/analyze
Content-Type: multipart/form-data

Form Data:
- carrier: <Carrier image>
- payload_size: Expected plaintext payload size in bytes
```

**Response (200):**
```json
{
  "status": "success",
  "method": "dct",
  "estimated_capacity_bytes": 420000,
  "payload_size": 240000,
  "fits": true,
  "visual_metrics": {
    "mse": 0.09,
    "psnr": 58.1,
    "ssim": 0.999
  }
}
```

---

## Ops Endpoints

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "services": {
    "database": {
      "connected": false,
      "readyState": 0
    },
    "queue": {
      "connected": false
    }
  }
}
```

### Readiness Check
```http
GET /ready
```

**Response (200 or 503):**
```json
{
  "status": "ready",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "services": {
    "database": {
      "connected": true,
      "readyState": 1
    },
    "queue": {
      "connected": true
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "message": "Missing required field: password",
    "statusCode": 400,
    "timestamp": "2026-03-07T10:00:00Z"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired token",
    "statusCode": 401,
    "timestamp": "2026-03-07T10:00:00Z"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "message": "Access denied - context mismatch",
    "statusCode": 403,
    "timestamp": "2026-03-07T10:00:00Z"
  }
}
```

### 413 Payload Too Large
```json
{
  "error": {
    "message": "File exceeds maximum size (50 MB)",
    "statusCode": 413,
    "timestamp": "2026-03-07T10:00:00Z"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "message": "Internal server error",
    "statusCode": 500,
    "timestamp": "2026-03-07T10:00:00Z"
  }
}
```

---

## Rate Limiting

All endpoints are rate-limited:
- **Default**: 100 requests/minute per IP
- **Upload**: 10 requests/minute per user
- **Auth**: 20 requests/minute per IP
- **Decrypt**: 30 requests/minute per user

Response headers include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1646652000
```

---

## Webhook Events (Future)

```json
{
  "event": "file.uploaded",
  "timestamp": "2026-03-07T10:00:00Z",
  "data": {
    "fileId": "file_uuid",
    "userId": "user_uuid",
    "fileSize": 5242880
  }
}
```

---

**Last Updated**: March 2026 | **Status**: MVP Phase
