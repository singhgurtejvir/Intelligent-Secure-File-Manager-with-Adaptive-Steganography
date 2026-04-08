import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import {
  createShare,
  getPublicCodeDownload,
  getPublicCodeShare,
  getPublicLinkDownload,
  getPublicLinkShare,
  getReceivedShareDownload,
  listReceivedShares,
  listSentShares,
} from '../controllers/shareController.js'
import { createRateLimit } from '../middleware/rateLimit.js'

type ShareControllerContract = {
  createShare: typeof createShare
  listReceivedShares: typeof listReceivedShares
  listSentShares: typeof listSentShares
  getReceivedShareDownload: typeof getReceivedShareDownload
  getPublicLinkShare: typeof getPublicLinkShare
  getPublicCodeShare: typeof getPublicCodeShare
  getPublicLinkDownload: typeof getPublicLinkDownload
  getPublicCodeDownload: typeof getPublicCodeDownload
}

export function createShareRouter({
  shareController = {
    createShare,
    listReceivedShares,
    listSentShares,
    getReceivedShareDownload,
    getPublicLinkShare,
    getPublicCodeShare,
    getPublicLinkDownload,
    getPublicCodeDownload,
  } satisfies ShareControllerContract,
}: {
  shareController?: ShareControllerContract
} = {}) {
  const router = Router()
  const createShareRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'share-create' })
  const publicLookupRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'share-public' })

  router.get('/link/:token', publicLookupRateLimit, async (req, res) => {
    try {
      const summary = await shareController.getPublicLinkShare(req.params.token)
      res.json(summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share not found'
      res.status(message.includes('not found') ? 404 : 500).json({ error: message })
    }
  })

  router.get('/link/:token/download', publicLookupRateLimit, async (req, res) => {
    try {
      const result = await shareController.getPublicLinkDownload(req.params.token)
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.downloadFileName)}"`)
      res.send(result.content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share not found'
      res.status(message.includes('not found') ? 404 : 500).json({ error: message })
    }
  })

  router.get('/code/:code', publicLookupRateLimit, async (req, res) => {
    try {
      const summary = await shareController.getPublicCodeShare(req.params.code)
      res.json(summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share not found'
      res.status(message.includes('not found') ? 404 : 500).json({ error: message })
    }
  })

  router.get('/code/:code/download', publicLookupRateLimit, async (req, res) => {
    try {
      const result = await shareController.getPublicCodeDownload(req.params.code)
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.downloadFileName)}"`)
      res.send(result.content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share not found'
      res.status(message.includes('not found') ? 404 : 500).json({ error: message })
    }
  })

  router.use(authMiddleware)

  router.get('/received', async (req: AuthRequest, res) => {
    try {
      const shares = await shareController.listReceivedShares(req.userId!)
      res.json(shares)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch received shares'
      res.status(500).json({ error: message })
    }
  })

  router.get('/sent', async (req: AuthRequest, res) => {
    try {
      const shares = await shareController.listSentShares(req.userId!)
      res.json(shares)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sent shares'
      res.status(500).json({ error: message })
    }
  })

  router.post('/', createShareRateLimit, async (req: AuthRequest, res) => {
    try {
      const share = await shareController.createShare(req.userId!, req.email || '', {
        fileId: req.body.fileId,
        shareType: req.body.shareType,
        deliveryMode: req.body.deliveryMode,
        recipientEmail: req.body.recipientEmail,
        password: req.body.password,
      })

      res.status(201).json(share)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share'
      res.status(message.includes('not found') || message.includes('required') || message.includes('Unsupported') || message.includes('only') || message.includes('not available') ? 400 : 500).json({ error: message })
    }
  })

  router.get('/received/:id/download', async (req: AuthRequest, res) => {
    try {
      const result = await shareController.getReceivedShareDownload(req.userId!, req.params.id)
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.downloadFileName)}"`)
      res.send(result.content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share not found'
      res.status(message.includes('not found') ? 404 : 500).json({ error: message })
    }
  })

  return router
}

const router = createShareRouter()

export default router
