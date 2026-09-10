import { createApp } from '../server';

// Cache the app across invocations (serverless warm reuse).
let cachedApp: any = null;
const ensureApp = async () => {
  if (!cachedApp) cachedApp = await createApp();
  return cachedApp;
};

export default async function handler(req: any, res: any) {
  const app = await ensureApp();
  return app(req, res);
}
