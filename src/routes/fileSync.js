const express = require('express');
const sync = require('../utils/fileSync/localSyncManager');
const { strictRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const route = (handler, status = 200) => async (req, res) => {
  try { res.status(status).json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message, code: error.code }); }
};
router.get('/jobs', route(() => sync.list()));
router.post('/jobs', strictRateLimiter, route((req) => sync.create(req.body), 201));
router.put('/jobs/:id', strictRateLimiter, route((req) => sync.update(req.params.id, req.body)));
router.delete('/jobs/:id', strictRateLimiter, route((req) => sync.remove(req.params.id)));
router.post('/jobs/:id/preview', strictRateLimiter, route((req) => sync.start(req.params.id, 'preview'), 202));
router.post('/jobs/:id/run', strictRateLimiter, route((req) => sync.start(req.params.id, 'run'), 202));
router.post('/jobs/:id/verify', strictRateLimiter, route((req) => sync.start(req.params.id, 'verify'), 202));
router.post('/jobs/:id/resolve', strictRateLimiter, route((req) => sync.start(req.params.id, 'resolve', req.body), 202));
router.post('/jobs/:id/review', strictRateLimiter, route((req) => sync.review(req.params.id, req.body)));
router.get('/jobs/:id/history', route((req) => sync.history(req.params.id, req.query.relative)));
router.post('/jobs/:id/restore', strictRateLimiter, route((req) => sync.start(req.params.id, 'restore', req.body), 202));
router.get('/runs/:id', route((req) => sync.getRun(req.params.id)));
router.get('/runs/:id/results', route((req) => {
  const offset = Number(req.query.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw Object.assign(new Error('Offset inválido'), { statusCode: 400 });
  return sync.results(req.params.id, offset);
}));
router.post('/runs/:id/cancel', strictRateLimiter, route((req) => sync.cancel(req.params.id), 202));
module.exports = router;
