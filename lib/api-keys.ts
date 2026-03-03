import { prisma } from '@/lib/prisma';

/**
 * Read an API key from the AppSetting table.
 * Keys are stored with the prefix "api_key_" + provider name.
 */
export async function getApiKey(provider: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: `api_key_${provider}` },
  });
  return setting?.value ?? null;
}

/**
 * Save an API key to the AppSetting table (upsert).
 */
export async function setApiKey(provider: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: `api_key_${provider}` },
    update: { value },
    create: { key: `api_key_${provider}`, value },
  });
}

/**
 * Delete an API key from the AppSetting table.
 */
export async function deleteApiKey(provider: string): Promise<void> {
  await prisma.appSetting.deleteMany({
    where: { key: `api_key_${provider}` },
  });
}

/**
 * Get all configured API keys with masked values (last 4 chars visible).
 */
export async function getApiKeyStatuses(): Promise<
  Record<string, { configured: boolean; maskedValue: string }>
> {
  const settings = await prisma.appSetting.findMany({
    where: { key: { startsWith: 'api_key_' } },
  });

  const result: Record<string, { configured: boolean; maskedValue: string }> = {};

  for (const setting of settings) {
    const provider = setting.key.replace('api_key_', '');
    const val = setting.value;
    const masked =
      val.length > 4
        ? '••••••••' + val.slice(-4)
        : '••••';
    result[provider] = { configured: true, maskedValue: masked };
  }

  return result;
}
