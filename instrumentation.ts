export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializePool } = await import('./lib/db');
    await initializePool();
  }
}
