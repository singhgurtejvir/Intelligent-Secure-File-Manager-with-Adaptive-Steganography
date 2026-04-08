import request from 'supertest'
import { createApp } from './app.js'
import { createAuthRouter } from './routes/auth.js'
import { createFileRouter } from './routes/files.js'
import { createShareRouter } from './routes/shares.js'
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
const handlePlainFileUploadMock = jest.fn()
const getFileListMock = jest.fn()
const deleteFileMock = jest.fn()
const decryptStoredFileMock = jest.fn()
const createShareMock = jest.fn()
const listReceivedSharesMock = jest.fn()
const listSentSharesMock = jest.fn()
const getReceivedShareDownloadMock = jest.fn()
const getPublicLinkShareMock = jest.fn()
const getPublicCodeShareMock = jest.fn()
const getPublicLinkDownloadMock = jest.fn()
const getPublicCodeDownloadMock = jest.fn()

describe('app integration', () => {
  const authRouter = createAuthRouter({
    userModel: userModelMock as never,
  })
  const fileRouter = createFileRouter({
    fileModel: fileModelMock,
    fileController: {
      handleFileUpload: handleFileUploadMock,
      handlePlainFileUpload: handlePlainFileUploadMock,
      getFileList: getFileListMock,
      deleteFile: deleteFileMock,
      decryptStoredFile: decryptStoredFileMock,
    },
  })
  const shareRouter = createShareRouter({
    shareController: {
      createShare: createShareMock,
      listReceivedShares: listReceivedSharesMock,
      listSentShares: listSentSharesMock,
      getReceivedShareDownload: getReceivedShareDownloadMock,
      getPublicLinkShare: getPublicLinkShareMock,
      getPublicCodeShare: getPublicCodeShareMock,
      getPublicLinkDownload: getPublicLinkDownloadMock,
      getPublicCodeDownload: getPublicCodeDownloadMock,
    },
  })
  const app = createApp({ authRouter, fileRouter, shareRouter })
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

  it('uploads a plain file without embedding', async () => {
    handlePlainFileUploadMock.mockResolvedValueOnce({
      _id: 'file-plain-1',
      name: 'notes.pdf',
      createdAt: new Date().toISOString(),
      storageMode: 'plain',
    })

    const response = await request(app)
      .post('/api/files/plain-upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4 plain file payload'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      })

    expect(response.status).toBe(201)
    expect(handlePlainFileUploadMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        originalname: 'notes.pdf',
      }),
    )
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

  it('creates a share for an authenticated sender', async () => {
    createShareMock.mockResolvedValueOnce({
      id: 'share-1',
      shareType: 'link',
      deliveryMode: 'plain-file',
      downloadFileName: 'notes.pdf',
      url: 'http://localhost:5173/receive?link=abc123',
    })

    const response = await request(app)
      .post('/api/shares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileId: 'file-plain-1',
        shareType: 'link',
        deliveryMode: 'plain-file',
      })

    expect(response.status).toBe(201)
    expect(createShareMock).toHaveBeenCalledWith(
      'user-1',
      'user@example.com',
      expect.objectContaining({
        fileId: 'file-plain-1',
        shareType: 'link',
        deliveryMode: 'plain-file',
      }),
    )
  })

  it('lists received account shares for an authenticated recipient', async () => {
    listReceivedSharesMock.mockResolvedValueOnce([
      {
        id: 'share-2',
        shareType: 'account',
        deliveryMode: 'payload-file',
        downloadFileName: 'secret.pdf',
      },
    ])

    const response = await request(app)
      .get('/api/shares/received')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
  })

  it('resolves a public code share', async () => {
    getPublicCodeShareMock.mockResolvedValueOnce({
      id: 'share-3',
      shareType: 'code',
      deliveryMode: 'plain-file',
      code: 'ABCD1234',
      downloadFileName: 'notes.pdf',
    })

    const response = await request(app).get('/api/shares/code/ABCD1234')

    expect(response.status).toBe(200)
    expect(response.body.code).toBe('ABCD1234')
  })

  it('downloads a public link share', async () => {
    getPublicLinkDownloadMock.mockResolvedValueOnce({
      content: Buffer.from('shared-bytes'),
      mimeType: 'text/plain',
      downloadFileName: 'shared.txt',
    })

    const response = await request(app).get('/api/shares/link/token-1/download')

    expect(response.status).toBe(200)
    expect(response.header['content-type']).toContain('text/plain')
    expect(response.text).toBe('shared-bytes')
  })
})
