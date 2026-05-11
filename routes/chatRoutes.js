import express from 'express';
import { handleChat } from '../controllers/chatController.js';

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.error('[ROUTER] Chat request incoming:', req.method, req.path);
  next();
});

// Define the POST route for chat
router.post('/', (req, res, next) => {
  console.error('[ROUTE POST] /api/chat POST handler called');
  console.error('[ROUTE POST] Body:', req.body);
  next();
}, handleChat);

export default router;