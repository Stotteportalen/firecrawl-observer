import { db } from '@/lib/db';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

const DEFAULT_SETTINGS = {
  defaultWebhookUrl: null,
  emailNotificationsEnabled: true,
  emailTemplate: null,
  aiAnalysisEnabled: false,
  aiModel: null,
  aiBaseUrl: null,
  aiSystemPrompt: null,
  aiMeaningfulChangeThreshold: 70,
  aiApiKey: null,
  emailOnlyIfMeaningful: false,
  webhookOnlyIfMeaningful: false,
};

async function decryptSettingsApiKey(settings: Record<string, unknown>) {
  if (settings?.aiApiKey && isEncrypted(settings.aiApiKey as string)) {
    try {
      const decryptedKey = await decrypt(settings.aiApiKey as string);
      return { ...settings, aiApiKey: decryptedKey };
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return { ...settings, aiApiKey: null };
    }
  }
  return settings;
}

export async function getUserSettings(userId: string) {
  const settings = await db.fcoUserSettings.findUnique({ where: { userId } });
  if (!settings) return DEFAULT_SETTINGS;
  return decryptSettingsApiKey(settings);
}

export async function getUserSettingsInternal(userId: string) {
  const settings = await db.fcoUserSettings.findUnique({ where: { userId } });
  if (!settings) return null;
  return decryptSettingsApiKey(settings);
}

export async function updateDefaultWebhook(userId: string, webhookUrl?: string) {
  if (webhookUrl) {
    try { new URL(webhookUrl); } catch { throw new Error('Invalid webhook URL'); }
  }

  await db.fcoUserSettings.upsert({
    where: { userId },
    update: { defaultWebhookUrl: webhookUrl || null },
    create: {
      userId,
      defaultWebhookUrl: webhookUrl || null,
      emailNotificationsEnabled: true,
    },
  });
  return { success: true };
}

export async function toggleEmailNotifications(userId: string, enabled: boolean) {
  await db.fcoUserSettings.upsert({
    where: { userId },
    update: { emailNotificationsEnabled: enabled },
    create: {
      userId,
      emailNotificationsEnabled: enabled,
    },
  });
  return { success: true };
}

export async function updateEmailTemplate(userId: string, template: string) {
  await db.fcoUserSettings.upsert({
    where: { userId },
    update: { emailTemplate: template },
    create: {
      userId,
      emailTemplate: template,
      emailNotificationsEnabled: true,
    },
  });
  return { success: true };
}

export async function updateAISettings(userId: string, data: {
  enabled: boolean;
  model?: string;
  baseUrl?: string;
  systemPrompt?: string;
  threshold?: number;
  apiKey?: string;
}) {
  let encryptedApiKey: string | undefined;
  if (data.apiKey !== undefined) {
    if (data.apiKey) {
      encryptedApiKey = await encrypt(data.apiKey);
    } else {
      encryptedApiKey = '';
    }
  }

  const updateData: Record<string, unknown> = {
    aiAnalysisEnabled: data.enabled,
    ...(data.model && { aiModel: data.model }),
    ...(data.baseUrl !== undefined && { aiBaseUrl: data.baseUrl }),
    ...(data.systemPrompt !== undefined && { aiSystemPrompt: data.systemPrompt }),
    ...(data.threshold !== undefined && { aiMeaningfulChangeThreshold: data.threshold }),
    ...(encryptedApiKey !== undefined && { aiApiKey: encryptedApiKey }),
  };

  await db.fcoUserSettings.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      emailNotificationsEnabled: true,
      ...updateData,
      aiMeaningfulChangeThreshold: (updateData.aiMeaningfulChangeThreshold as number) || 70,
    },
  });
  return { success: true };
}

export async function updateNotificationFiltering(userId: string, data: {
  emailOnlyIfMeaningful?: boolean;
  webhookOnlyIfMeaningful?: boolean;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.emailOnlyIfMeaningful !== undefined) updateData.emailOnlyIfMeaningful = data.emailOnlyIfMeaningful;
  if (data.webhookOnlyIfMeaningful !== undefined) updateData.webhookOnlyIfMeaningful = data.webhookOnlyIfMeaningful;

  await db.fcoUserSettings.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      emailNotificationsEnabled: true,
      ...updateData,
    },
  });
  return { success: true };
}
