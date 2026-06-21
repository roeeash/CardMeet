import { BaseModel } from '../BaseModel';
import type { Notification, NotificationType } from '../../shared/types/notification';

export class NotificationModel extends BaseModel {
  static tableName = 'notifications';

  static async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<Notification> {
    const [notification] = await this.db(this.tableName)
      .insert({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data || null,
        read: false,
        created_at: new Date(),
      })
      .returning('*');

    return notification;
  }

  static async getNotifications(userId: string): Promise<Notification[]> {
    return this.db(this.tableName)
      .where('user_id', userId)
      .where('read', false)
      .orderBy('created_at', 'desc');
  }

  static async markAsRead(notificationId: string): Promise<Notification> {
    const [notification] = await this.db(this.tableName)
      .where('id', notificationId)
      .update({
        read: true,
        updated_at: new Date(),
      })
      .returning('*');

    return notification;
  }
}
