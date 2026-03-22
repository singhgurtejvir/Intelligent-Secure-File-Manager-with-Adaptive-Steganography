export interface ApiErrorPayload {
  error?: string | { message?: string }
  decoyContent?: string
  contextScore?: number
}

export class ApiError extends Error {
  decoyContent?: string
  statusCode?: number
  contextScore?: number

  constructor(message: string, options?: { decoyContent?: string; statusCode?: number; contextScore?: number }) {
    super(message)
    this.name = 'ApiError'
    this.decoyContent = options?.decoyContent
    this.statusCode = options?.statusCode
    this.contextScore = options?.contextScore
  }
}

export interface FileContextCheck {
  allowed: boolean
  score: number
  signals: {
    deviceFingerprint: number | null
    timezone: boolean | null
    language: boolean | null
    userAgent: boolean | null
  }
}

export interface UploadResult {
  _id: string
  name: string
  carrierOriginalName: string
  createdAt: string
}

export interface VaultFile {
  id: string
  name: string
  carrierOriginalName: string
  type: string
  carrierMimeType: string
  carrierSize: number
  originalPayloadSize: number
  originalPayloadName: string
  steganographyMethod?: 'lsb' | 'dct' | 'multi-file'
  storageMode?: 'embedded' | 'encrypted-file'
  capacityUsedPercent?: number
  shardCount?: number
  createdAt: string
}

const API_BASE_URL = 'http://localhost:3000'

function getAuthHeaders(): Record<string, string> {
  // Get token from localStorage (set by auth store)
  const auth = localStorage.getItem('auth-storage')
  let token = null

  if (auth) {
    try {
      const authData = JSON.parse(auth)
      token = authData.state?.token
    } catch (e) {
      // Ignore parse errors
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

async function parseApiError(response: Response): Promise<never> {
  let payload: ApiErrorPayload | null = null

  try {
    payload = (await response.json()) as ApiErrorPayload
  } catch {
    // Ignore malformed error payloads.
  }

  const message =
    typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message || 'Request failed'

  throw new ApiError(message, {
    decoyContent: payload?.decoyContent,
    statusCode: response.status,
    contextScore: payload?.contextScore,
  })
}

// Authentication endpoints
export async function registerUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.json()
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.json()
}

// File endpoints
export async function uploadFile(
  carrierFile: File,
  payloadFile: File,
  password: string,
  context?: Record<string, unknown>,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('carrier', carrierFile)
  formData.append('payload', payloadFile)
  formData.append('password', password)
  if (context) {
    formData.append('context', JSON.stringify(context))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/api/files/upload`)

    const token = getAuthHeaders().Authorization
    if (token) {
      xhr.setRequestHeader('Authorization', token)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as UploadResult | ApiErrorPayload
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload as UploadResult)
          return
        }

        reject(
          new ApiError(
            typeof (payload as ApiErrorPayload).error === 'string'
              ? ((payload as ApiErrorPayload).error as string)
              : 'Upload failed',
            { decoyContent: (payload as ApiErrorPayload).decoyContent },
          ),
        )
      } catch {
        reject(new ApiError('Upload failed'))
      }
    }

    xhr.onerror = () => reject(new ApiError('Upload failed'))
    xhr.send(formData)
  })
}

export async function listFiles(): Promise<VaultFile[]> {
  const response = await fetch(`${API_BASE_URL}/api/files`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.json()
}

export async function deleteFile(fileId: string) {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.json()
}

export async function decryptFile(
  fileId: string,
  password: string,
  context: Record<string, unknown>,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/decrypt`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ password, context }),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.blob()
}

export async function checkFileContext(
  fileId: string,
  context: Record<string, unknown>,
): Promise<FileContextCheck> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/context-check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ context }),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.json()
}

export async function getCarrierFile(fileId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/carrier`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    await parseApiError(response)
  }

  return response.blob()
}
