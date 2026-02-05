import { streamText, tool } from 'ai';
import type { CoreMessage } from '../types/ai.types';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { aiToolsService } from './ai-tools.service';
import { keyManagementService } from './key-management.service';
import { chatHistoryService } from './chat-history.service';
import { systemContextService } from './system-context.service';
import { ToolContext } from '../types/ai.types';
import { logger } from '../utils/logger';

/**
 * Agent Executor Service
 * 
 * Orchestrates the AI's reasoning loop, tool execution, and streaming response.
 */
export class AgentExecutor {
  /**
   * Execute a natural language query against the platform data.
   * Returns a streaming text response.
   */
  public async query(prompt: string, context: ToolContext, overrides?: { provider?: string; model?: string }): Promise<any> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    // 0. Fetch System Context (Dynamic Preamble)
    const sysContext = await systemContextService.getContext();
    const preamble = systemContextService.getPromptPreamble(sysContext);

    // 1. Fetch History from Redis (Sliding Window of last 20 messages)
    const history = await chatHistoryService.getSlidingWindow(context.tenantId, context.userId, 20);

    // 2. Get active provider and model (from overrides or global defaults)
    const provider = overrides?.provider || await keyManagementService.getActiveProvider();
    const modelName = overrides?.model || await keyManagementService.getActiveModel(provider);

    // 3. Fetch the API Key from Redis for the active provider
    const apiKey = await keyManagementService.getKey(provider);
    if (!apiKey) {
      throw new Error(`AI API Key for ${provider} not configured. Please go to Settings -> AI Integrations to set it up.`);
    }

    // 4. Initialize the provider instance
    let modelInstance: any;
    
    switch (provider) {
      case 'anthropic':
        modelInstance = createAnthropic({ apiKey })(modelName);
        break;
      case 'gemini':
      case 'google':
        modelInstance = createGoogleGenerativeAI({ apiKey })(modelName);
        break;
      case 'openai':
      default:
        modelInstance = createOpenAI({ apiKey })(modelName);
        break;
    }

    // 5. Map our ReadOnlyTool registry to Vercel AI SDK tool format
    const registry = aiToolsService.getRegistry();
    const sdkTools: Record<string, any> = {};

    for (const [name, toolDef] of Object.entries(registry)) {
      sdkTools[name] = tool({
        description: toolDef.description,
        parameters: toolDef.parameters as any,
        execute: async (args: any) => {
          try {
            console.log(`[AI-AGENT] Executing tool: ${name} with args:`, JSON.stringify(args));
            toolsUsed.push(name);
            const toolStartTime = Date.now();
            const result = await toolDef.execute(args, context);
            const duration = Date.now() - toolStartTime;
            console.log(`[AI-AGENT] Tool ${name} completed in ${duration}ms with ${Array.isArray(result) ? result.length : 'non-array'} results`);
            return result;
          } catch (toolError: any) {
            console.error(`[AI-AGENT] Tool ${name} failed:`, toolError.message);
            return { error: toolError.message }; // Return error to AI instead of throwing to keep the reasoning loop alive
          }
        }
      } as any);
    }

    const systemPrompt = `
${preamble}

You are an expert Security Analyst for our organization. 
Your role is to analyze device inventory, user activity, and security policies strictly as an observer.

CORE PRINCIPLES:
1. READ-ONLY: You must never suggest or attempt to modify data.
2. CITATION: Always cite the specific data source (e.g., 'According to the Audit Logs...', 'The Device Compliance report shows...').
3. ACCURACY: Do not hallucinate. If a tool returns no data or the query is ambiguous, respond by asking for clarification or suggesting alternative search criteria to help the user find what they need.
4. PRIVACY: Do not expose internal technical IDs (GUIDs) to the user unless explicitly asked for troubleshooting. Use Display Names and UPNs instead.

DOMAIN KNOWLEDGE:
- Compliance States: 'compliant', 'non_compliant', 'grace_period'.
- OS Types: 'Windows', 'macOS', 'iOS', 'Android'.

FEW-SHOT EXAMPLES:
- User: "Why is user john@company.com blocked?" -> Thought: Check sign-in logs for failures using get_user_activity.
- User: "Who owns the iPad with serial ABC123?" -> Thought: search_devices to find the device, then get_device_owner.
- User: "How many Windows devices are non-compliant?" -> Thought: search_devices with OS filter and query compliance via check_compliance_status.
`;

    // 6. Initialize the stream with history
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: prompt }
      ],
      tools: sdkTools,
      maxSteps: 5,
      onFinish: async (finishArgs: any) => {
        const executionTime = Date.now() - startTime;
        console.log(`[AI-AGENT] onFinish called. Reason: ${finishArgs.finishReason}, Messages: ${finishArgs.responseMessages?.length || 0}`);
        
        // Save user message and assistant's full response sequence to Redis
        try {
          // Save the user prompt
          await chatHistoryService.saveMessage(context.tenantId, context.userId, { 
            role: 'user', 
            content: prompt 
          });

          // Save assistant messages (including tool calls and results)
          if (Array.isArray(finishArgs.responseMessages) && finishArgs.responseMessages.length > 0) {
            for (const msg of finishArgs.responseMessages) {
              await chatHistoryService.saveMessage(context.tenantId, context.userId, msg);
            }
          } else {
            console.warn('[AI] No response messages returned to save to history. Finish reason:', finishArgs.finishReason);
          }
        } catch (historyError) {
          console.error('[AI] Failed to save chat history:', historyError);
        }

        // Log the interaction to OpenSearch for auditing
        const totalTokens = finishArgs.usage?.totalTokens || 0;
        logger.log({
          level: 'info',
          action: 'AI_AGENT_INTERACTION',
          source: 'automation',
          message: `AI query completed in ${executionTime}ms`,
          metadata: {
            user_id: context.userId,
            tenant_id: context.tenantId,
            query: prompt,
            tools_used: toolsUsed,
            tokens_used: totalTokens,
            execution_time_ms: executionTime,
            finish_reason: finishArgs.finishReason,
            provider,
            model: modelName
          }
        });
      }
    } as any);

    return result;
  }
}

export const agentExecutor = new AgentExecutor();
