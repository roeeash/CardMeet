import { NotificationModel } from '../models/notification/Notification';
import type { Notification, NotificationType } from '@shared/types/notification';

/**
 * NotificationService provides a no-op safe wrapper around notification creation.
 * If the database fails, errors are logged but not thrown, ensuring the caller's
 * primary operation is not interrupted.
 */
export class NotificationService {
  static async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<Notification | Record<string, never>> {
    try {
      const notification = await NotificationModel.createNotification({
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data,
      });
      return notification;
    } catch (error) {
      // Log the error but don't throw - this is a best-effort side effect
      console.error('[NotificationService] Failed to create notification:', error);
      // Return empty object to indicate no-op
      return {};
    }
  }
}
