const { PrismaClient } = require('@prisma/client');

async function main() {
  // Try pooler connection on port 6543
  const poolerUrl = 'postgresql://postgres:fluorui%40654321@db.kunjksboaeksgmbcgdcm.supabase.co:6543/postgres';
  const db = new PrismaClient({ datasources: { db: { url: poolerUrl } } });
  try {
    await db.$connect();
    console.log('Pooler connected successfully!');
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('Query result:', result);
  } catch (e) {
    console.error('Pooler Error:', e.message);
    console.error('Code:', e.code);
  } finally {
    await db.$disconnect();
  }
}

main();
