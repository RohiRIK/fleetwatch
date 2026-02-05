import { Router, Request, Response } from 'express';
import { Client } from '@opensearch-project/opensearch';
import { agentExecutor } from '../services/ai-agent.service';
import { keyManagementService } from '../services/key-management.service';
import { chatHistoryService } from '../services/chat-history.service';
import { requireAuth } from '../middleware/session-auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

export function createAiRoutes(opensearchClient: Client): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/ai/history:
   *   get:
   *     tags:
   *       - AI Analyst
   *     summary: Get chat history for the current user
   */
  router.get(
    '/history',
    requireAuth(),
    asyncHandler(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId || 'default';
      const userId = (req as any).user?.id || 'unknown';
      
      const history = await chatHistoryService.getHistory(tenantId, userId);
      res.json({ success: true, data: history });
    })
  );

  /**
   * @swagger
   * /api/v2/ai/history:
   *   delete:
   *     tags:
   *       - AI Analyst
   *     summary: Clear chat history for the current user
   */
  router.delete(
    '/history',
    requireAuth(),
    asyncHandler(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId || 'default';
      const userId = (req as any).user?.id || 'unknown';
      
      await chatHistoryService.clearHistory(tenantId, userId);
      res.json({ success: true, message: 'Chat history cleared' });
    })
  );

  /**
   * @swagger
   * /api/v2/ai/config:
   *   get:
   *     tags:
   *       - AI Analyst
   *     summary: Get available AI providers and active config
   */
  router.get(
    '/config',
    requireAuth(),
    asyncHandler(async (req: Request, res: Response) => {
      const providers = ['openai', 'anthropic', 'gemini'];
      const available: string[] = [];
      const providerModels: Record<string, string[]> = {};
      
      for (const p of providers) {
        if (await keyManagementService.hasKey(p)) {
          available.push(p);
          providerModels[p] = await keyManagementService.getAvailableModels(p);
        }
      }

      let activeProvider = await keyManagementService.getActiveProvider();
      
      // If the globally active provider is not actually available (no key), 
      // fallback to the first available one.
      if (available.length > 0 && !available.includes(activeProvider)) {
        activeProvider = available[0];
      }

      const activeModel = available.length > 0 
        ? await keyManagementService.getActiveModel(activeProvider)
        : '';

      res.json({
        success: true,
        data: {
          availableProviders: available,
          providerModels,
          activeProvider: available.length > 0 ? activeProvider : '',
          activeModel
        }
      });
    })
  );

  /**
   * @swagger
   * /api/v2/ai/query:
   *   post:
   *     tags:
   *       - AI Analyst
   *     summary: Natural language data analysis
   *     description: Process a user prompt using the agentic Read-Only AI Analyst. Returns a streaming text response.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               prompt:
   *                 type: string
   *               provider:
   *                 type: string
   *               model:
   *                 type: string
   *     responses:
   *       200:
   *         description: Streaming text response
   */
  router.post(
    '/query',
    requireAuth(),
    asyncHandler(async (req: Request, res: Response) => {
      let { prompt, provider, model, messages } = req.body;

      // Compatibility with Vercel AI SDK which sends 'messages' array
      if (!prompt && Array.isArray(messages) && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
          if (typeof lastMessage.content === 'string' && lastMessage.content.length > 0) {
            prompt = lastMessage.content;
          } else if (Array.isArray(lastMessage.parts)) {
            prompt = lastMessage.parts
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('\n');
          }
        }
        
        if (!prompt && messages.length > 1) {
           // Fallback to second to last if last is somehow empty or assistant
           const prevMessage = messages[messages.length - 2];
           if (prevMessage.role === 'user' && typeof prevMessage.content === 'string') {
             prompt = prevMessage.content;
           }
        }
      }

      if (!prompt) {
        console.warn('[AI API] Missing prompt in request body:', JSON.stringify(req.body));
        return res.status(400).json({ success: false, error: 'Prompt is required' });
      }

      console.log(`[AI API] Processing query: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}" using ${provider || 'default'}/${model || 'default'}`);

      try {
        const result = await agentExecutor.query(prompt, {
          userId: (req as any).user?.id || 'unknown',
          tenantId: (req as any).user?.tenantId || 'default',
          opensearchClient
        }, { provider, model });

        if (!result || typeof result.pipeDataStreamToResponse !== 'function') {
          throw new Error('AI executor returned an invalid result object (missing pipeDataStreamToResponse)');
        }

        // Stream the response back using Vercel AI SDK Data Stream helpers
        result.pipeDataStreamToResponse(res);
      } catch (error: any) {
        console.error('[AI API] Execution error:', {
          message: error.message,
          stack: error.stack,
          userId: (req as any).user?.id,
          prompt: prompt.substring(0, 100)
        });
        
        // Handle specific provider errors
        let statusCode = error.statusCode || 500;
        let errorMessage = error.message || 'An internal error occurred during AI analysis';

        // Check for common provider errors
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
          statusCode = 429;
          errorMessage = 'The AI service is temporarily unavailable due to rate limits or quota exhaustion. Please try again later or switch to a different provider/model.';
        } else if (errorMessage.toLowerCase().includes('api key')) {
          statusCode = 401;
          errorMessage = 'The AI provider API key is invalid or missing. Please check your settings.';
        }
        
        // If headers haven't been sent, we can send a JSON error
        if (!res.headersSent) {
          return res.status(statusCode).json({ 
            success: false, 
            error: errorMessage,
            providerError: true 
          });
        }
        
        // If streaming already started, we just end it
        res.end();
      }
    })
  );

  return router;
}
