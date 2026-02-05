import { z } from 'zod';

/**
 * Context provided to every tool execution.
 * Ensures tools have access to the same database clients and user context.
 */
export interface ToolContext {
  userId: string;
  tenantId: string;
  opensearchClient: any;
  redisClient?: any;
}

/**
 * Standard interface for all Read-Only AI Tools.
 * Optimized for Vercel AI SDK compatibility.
 */
export interface ReadOnlyTool<P extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: P;
  /**
   * Execute the tool logic.
   * MUST be a read-only operation.
   */
  execute: (args: z.infer<P>, context: ToolContext) => Promise<any>;
}

/**
 * Registry of all available AI tools.
 */
export interface ToolRegistry {
  [name: string]: ReadOnlyTool<any>;
}

/**
 * CoreMessage interface shim to replace missing 'ai' export.
 */
export interface CoreMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | any[];
  name?: string;
  tool_call_id?: string;
}