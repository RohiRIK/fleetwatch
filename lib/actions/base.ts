import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';

/**
 * Standard result type for all server actions
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Options for creating server actions
 */
export interface ServerActionOptions {
  requireAuth?: boolean;
}

/**
 * Create a type-safe server action with automatic validation and error handling
 * 
 * @param schema Zod schema for input validation
 * @param handler Async function that implements the action logic
 * @param options Configuration options (requireAuth, etc.)
 * @returns A server action function that returns ActionResult<T>
 * 
 * @example
 * ```typescript
 * const myAction = createServerAction(
 *   z.object({ name: z.string() }),
 *   async (input, userId) => {
 *     // Your logic here
 *     return { message: `Hello ${input.name}` };
 *   }
 * );
 * ```
 */
export function createServerAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (input: TInput, userId?: string) => Promise<TOutput>,
  options: ServerActionOptions = { requireAuth: true }
) {
  return async (input: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Validate input against schema
      const parseResult = schema.safeParse(input);
      
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return {
          success: false,
          error: `Validation error: ${firstError.message} at ${firstError.path.join('.')}`,
        };
      }

      // 2. Check authentication if required
      let userId: string | undefined = undefined;
      
      if (options.requireAuth) {
        try {
          const session = await requireAuth();
          userId = session.user?.id;
        } catch (error) {
          return {
            success: false,
            error: 'Unauthorized: You must be logged in to perform this action',
          };
        }
      }

      // 3. Execute handler with validated input
      const result = await handler(parseResult.data, userId);

      return {
        success: true,
        data: result,
      };

    } catch (error: any) {
      // Log error for debugging
      console.error('[Server Action Error]', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Return user-friendly error
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
      };
    }
  };
}

/**
 * Create a server action that doesn't require authentication
 * 
 * @param schema Zod schema for input validation
 * @param handler Async function that implements the action logic
 * @returns A server action function that returns ActionResult<T>
 */
export function createPublicAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (input: TInput) => Promise<TOutput>
) {
  return createServerAction(
    schema,
    async (input) => handler(input),
    { requireAuth: false }
  );
}
