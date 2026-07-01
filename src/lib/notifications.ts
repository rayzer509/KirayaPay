import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from './prisma';

const expo = new Expo();

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async function getTokensForUser(userId: string): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({
    where: { user_id: userId },
    select: { token: true },
  });
  return rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
}

export async function notifyUser(userId: string, payload: NotificationPayload): Promise<void> {
  const tokens = await getTokensForUser(userId);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch {
    // Silently swallow — notification failure must never break a mutation
  }
}

export async function notifyTenantsByProperty(
  propertyId: string,
  payload: NotificationPayload,
): Promise<void> {
  const leases = await prisma.lease.findMany({
    where: { unit: { property_id: propertyId }, status: 'active', deleted_at: null },
    select: { tenant_id: true },
  });
  await Promise.all(leases.map((l) => notifyUser(l.tenant_id, payload)));
}
