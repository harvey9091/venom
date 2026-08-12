const { PrismaClient } = require('@prisma/client');

async function main() {
  const db = new PrismaClient();
  try {
    await db.$connect();
    console.log('Connected successfully!');
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('Query result:', result);
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
    console.error('Meta:', e.meta);
  } finally {
    await db.$disconnect();
  }
}

main();
