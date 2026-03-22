import request from 'supertest'
import { createApp } from './app.js'
import { createAuthRouter } from './routes/auth.js'
import { createFileRouter } from './routes/files.js'
import { generateToken } from './utils/auth.js'

const saveUserMock = jest.fn()
const findUserMock = jest.fn()
const userConstructorMock = jest.fn().mockImplementation((payload) => ({
  ...payload,
  _id: 'user-1',
  save: saveUserMock,
}))
const userModelMock = Object.assign(userConstructorMock, {
  findOne: findUserMock,
})

const findFileByIdMock = jest.fn()
const fileModelMock = {
  findById: findFileByIdMock,
}

const handleFileUploadMock = jest.fn()
const getFileListMock = jest.fn()
const deleteFileMock = jest.fn()
const decryptStoredFileMock = jest.fn()

describe('app integration', () => {
  const authRouter = createAuthRouter({
    userModel: userModelMock as never,
  })
  const fileRouter = createFileRouter({
    fileModel: fileModelMock,
    fileController: {
      handleFileUpload: handleFileUploadMock,
      getFileList: getFileListMock,
      deleteFile: deleteFileMock,
      decryptStoredFile: decryptStoredFileMock,
    },
  })
  const app = createApp({ authRouter, fileRouter })
  const token = generateToken('user-1', 'user@example.com')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports service health', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.services).toEqual({
      database: expect.objectContaining({
        connected: false,
        readyState: expect.any(Number),
      }),
      queue: expect.objectContaining({
        connected: false,
      }),
    })
  })

  it('reports degraded readiness when dependencies are offline', async () => {
    const response = await request(app).get('/ready')

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('degraded')
  })

  it('registers a user through the auth route', async () => {
    findUserMock.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(null),
    })
    saveUserMock.mockResolvedValueOnce(undefined)

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'password123' })

    expect(response.status).toBe(201)
    expect(response.body.email).toBe('user@example.com')
    expect(response.body.token).toBeTruthy()
  })

  it('lists files for an authenticated user', async () => {
    getFileListMock.mockResolvedValueOnce([
      { id: 'file-1', originalPayloadName: 'secret.pdf' },
    ])

    const response = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(getFileListMock).toHaveBeenCalledWith('user-1')
  })

  it('uploads carrier and payload files', async () => {
    handleFileUploadMock.mockResolvedValueOnce({
      _id: 'file-1',
      name: 'secret.pdf',
      createdAt: new Date().toISOString(),
    })

    const response = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('password', 'password123')
      .attach('carrier', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'cover.png',
        contentType: 'image/png',
      })
      .attach('payload', Buffer.from('%PDF-1.4 test payload'), {
        filename: 'secret.pdf',
        contentType: 'application/pdf',
      })

    expect(response.status).toBe(201)
    expect(handleFileUploadMock).toHaveBeenCalled()
  })

  it('decrypts and returns binary content', async () => {
    findFileByIdMock.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        _id: 'file-1',
        userId: 'user-1',
      }),
    })
    decryptStoredFileMock.mockResolvedValueOnce({
      allowed: true,
      content: Buffer.from('secret-bytes'),
      fileName: 'secret.txt',
      mimeType: 'text/plain',
    })

    const response = await request(app)
      .post('/api/files/file-1/decrypt')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'password123', context: { deviceFingerprint: 'fp-1' } })

    expect(response.status).toBe(200)
    expect(response.header['content-type']).toContain('text/plain')
    expect(response.text).toBe('secret-bytes')
  })

  it('checks file context for an authenticated user', async () => {
    findFileByIdMock.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        _id: 'file-1',
        userId: 'user-1',
        context: {
          deviceFingerprint: 'fp-1',
        },
      }),
    })

    const response = await request(app)
      .post('/api/files/file-1/context-check')
      .set('Authorization', `Bearer ${token}`)
      .send({ context: { deviceFingerprint: 'fp-1' } })

    expect(response.status).toBe(200)
    expect(response.body.allowed).toBe(true)
    expect(response.body.score).toBeGreaterThan(0)
  })

  it('returns decoy content metadata when context validation fails', async () => {
    findFileByIdMock.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        _id: 'file-2',
        userId: 'user-1',
      }),
    })
    decryptStoredFileMock.mockResolvedValueOnce({
      allowed: false,
      decoyContent: 'public image placeholder',
      score: 0.32,
    })

    const response = await request(app)
      .post('/api/files/file-2/decrypt')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'password123', context: { deviceFingerprint: 'fp-2' } })

    expect(response.status).toBe(403)
    expect(response.body.decoyContent).toBe('public image placeholder')
    expect(response.body.contextScore).toBe(0.32)
  })

  it('deletes a file through the API', async () => {
    deleteFileMock.mockResolvedValueOnce({ _id: 'file-1' })

    const response = await request(app)
      .delete('/api/files/file-1')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(deleteFileMock).toHaveBeenCalledWith('user-1', 'file-1')
  })
})
