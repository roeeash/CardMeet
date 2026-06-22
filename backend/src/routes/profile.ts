import { Router, Request, Response } from 'express';
import { ProfileService } from '@services/ProfileService';
import { authenticate, AuthRequest } from '@middleware/auth';
import { getStatusCode, formatErrorResponse } from '@utils/errorHandler';
import { validateRequest, updateProfileSchema } from '@middleware/validation';
import { profileResponseToDTO, profileToDTO } from '@utils/dto';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await ProfileService.getProfile(req.user!.userId);
    res.status(200).json(profileResponseToDTO(profile.user, profile.profile));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.put('/', authenticate, validateRequest(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Convert camelCase to snake_case for database
    const updateData: any = {};
    if (req.body.displayName !== undefined) updateData.display_name = req.body.displayName;
    if (req.body.display_name !== undefined) updateData.display_name = req.body.display_name;
    if (req.body.locationLat !== undefined) updateData.location_lat = req.body.locationLat;
    if (req.body.location_lat !== undefined) updateData.location_lat = req.body.location_lat;
    if (req.body.locationLng !== undefined) updateData.location_lng = req.body.locationLng;
    if (req.body.location_lng !== undefined) updateData.location_lng = req.body.location_lng;
    if (req.body.travelRadiusKm !== undefined) updateData.travel_radius_km = req.body.travelRadiusKm;
    if (req.body.travel_radius_km !== undefined) updateData.travel_radius_km = req.body.travel_radius_km;
    if (req.body.games !== undefined) updateData.games = req.body.games;

    const profile = await ProfileService.updateProfile(req.user!.userId, updateData);
    res.status(200).json(profileToDTO(profile));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.get('/:userId/public', async (req: Request, res: Response) => {
  try {
    const profile = await ProfileService.getPublicProfile(req.params.userId);
    res.status(200).json(profileToDTO(profile));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
