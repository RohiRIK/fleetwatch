
import { encrypt } from '../src/utils/crypto';
import Redis from 'ioredis';

const redis = new Redis('redis://default:changeme@redis:6379');
const adminToken = "6093e935a16f8f88c535b244b714dd1d6f9d7988d6d2fe9199bad6fdc3b8bbd8";
const apiBase = "http://api-ts:3001";

async function main() {
  const encToken = encrypt(adminToken);
  const encApi = encrypt(apiBase);
  
  await redis.setex('fetcher:admin_token', 86400, encToken);
  await redis.setex('fetcher:api_base', 86400, encApi);
  
  console.log('Injected encrypted keys into Redis');
  redis.disconnect();
}

main();
