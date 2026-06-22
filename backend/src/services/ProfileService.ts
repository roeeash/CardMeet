import { UserModel, UserProfileModel } from '../models/user/User';
import type { User, UserProfile } from '../../../shared/types/user';

type UserRow = User & { password_hash: string };

export class ProfileService {
  static async getProfile(userId: string): Promise<{ user: UserRow; profile: UserProfile }> {
    const [user, profile] = await Promise.all([
      UserModel.findById(userId),
      UserProfileModel.findByUserId(userId),
    ]);

    if (!user) throw new Error('User not found');
    if (!profile) throw new Error('Profile not found');

    return { user, profile };
  }

  static async getPublicProfile(targetUserId: string) {
    const profile = await UserProfileModel.findByUserId(targetUserId);
    if (!profile) throw new Error('Profile not found');
    // Strip private fields
    const { ...pub } = profile as any;
    delete pub.location_lat;
    delete pub.location_lng;
    return pub;
  }

  static async updateProfile(userId: string, data: any) {
    return UserProfileModel.updateProfile(userId, data);
  }
}
