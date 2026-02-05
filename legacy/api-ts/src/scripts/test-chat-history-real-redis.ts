import { chatHistoryService } from '../services/chat-history.service';
import { redisSessionService } from '../services/redis-session.service';

async function test() {
  console.log('--- ChatHistoryService Real Redis Test ---');
  
  // Initialize Redis connection
  await redisSessionService.initialize();
  
  const tenantId = 'test-tenant';
  const userId = 'test-user';
  const message: any = { role: 'user', content: 'Testing real Redis persistence: ' + new Date().toISOString() };

  console.log('Saving message...');
  await chatHistoryService.saveMessage(tenantId, userId, message);
  
  console.log('Retrieving history...');
  const history = await chatHistoryService.getHistory(tenantId, userId);
  
  console.log('History count:', history.length);
  const lastMessage = history[history.length - 1];
  console.log('Last message content:', lastMessage.content);

  if (lastMessage.content === message.content) {
    console.log('✅ Success: Message correctly stored and retrieved!');
  } else {
    console.error('❌ Failure: Message mismatch!');
    process.exit(1);
  }

  // Test clearing
  console.log('Clearing history...');
  await chatHistoryService.clearHistory(tenantId, userId);
  const clearedHistory = await chatHistoryService.getHistory(tenantId, userId);
  console.log('History count after clear:', clearedHistory.length);

  if (clearedHistory.length === 0) {
    console.log('✅ Success: History cleared!');
  } else {
    console.error('❌ Failure: History not cleared!');
    process.exit(1);
  }

  await redisSessionService.close();
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
