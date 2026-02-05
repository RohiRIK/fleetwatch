import { agentExecutor } from "../src/services/ai-agent.service";
import { keyManagementService } from "../src/services/key-management.service";
import { createOpenSearchClient } from "../src/config/opensearch";
import { redisSessionService } from "../src/services/redis-session.service";

async function testModel(modelName: string) {
  console.log(`\n--- Testing Model: ${modelName} ---`);
  
  await redisSessionService.initialize();
  const opensearchClient = createOpenSearchClient();

  // 1. List available models first to see what we actually have
  try {
    console.log("Fetching available Gemini models...");
    const models = await keyManagementService.getAvailableModels("gemini");
    console.log("Available Gemini Models:", models);
  } catch (e: any) {
    console.error("Failed to list models:", e.message);
  }

  const context = {
    userId: "test-diagnostic",
    tenantId: "default",
    opensearchClient
  };

  try {
    const result = await agentExecutor.query(
      "Ping! Are you there? Just say 'Yes' if you can read this.", 
      context as any, 
      { provider: "gemini", model: modelName }
    );

    console.log("Stream initialized. Consuming response...");
    
    // We mock a response object to capture the stream
    const mockRes: any = {
      write: (chunk: any) => process.stdout.write(chunk.toString()),
      end: () => console.log("\n--- Stream Finished ---"),
      setHeader: () => {},
      status: (code: number) => {
        console.log(`Response Status: ${code}`);
        return mockRes;
      }
    };

    await result.pipeTextStreamToResponse(mockRes);
  } catch (error: any) {
    console.error(`\n!!! Model ${modelName} Failed:`, error.message);
    if (error.responseBody) console.error("Response Body:", error.responseBody);
  } finally {
    await redisSessionService.close();
  }
}

const targetModel = process.argv[2] || "gemini-1.5-flash";
testModel(targetModel).catch(console.error);
