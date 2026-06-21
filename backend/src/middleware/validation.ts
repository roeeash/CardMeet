/**
 * Input validation middleware using Joi.
 * Provides validateRequest middleware factory and schema definitions for all endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware factory that validates request body against a Joi schema.
 * Returns 400 with validation errors if schema fails.
 */
export function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map(d => d.message).join(', ');
      res.status(400).json({ error: `Validation failed: ${details}` });
      return;
    }
    // Replace req.body with validated (and coerced) value
    req.body = value;
    next();
  };
}

/**
 * Auth endpoint schemas
 */
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * Listing endpoint schemas
 */
export const createListingSchema = Joi.object({
  card_name: Joi.string().required(),
  card_set: Joi.string().optional(),
  condition: Joi.string().valid('nm', 'lp', 'mp', 'hp').required(),
  price_cents: Joi.number().integer().positive().required(),
  game: Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana').required(),
});

export const updateListingStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'sold').required(),
});

/**
 * Deal endpoint schemas
 * API accepts prices in whole shekels; backend converts to cents internally
 */
export const createDealSchema = Joi.object({
  listingId: Joi.string().uuid().required(),
  initialOfferPrice: Joi.number().integer().positive().required(),
});

export const makeOfferSchema = Joi.object({
  price: Joi.number().integer().positive().required(),
  note: Joi.string().optional(),
});

/**
 * Event endpoint schemas
 */
export const rsvpSchema = Joi.object({
  status: Joi.string().valid('going', 'maybe', 'no').required(),
});

/**
 * Meetup endpoint schemas
 */
export const scheduleMeetupSchema = Joi.object({
  dealId: Joi.string().uuid().required(),
  eventId: Joi.string().uuid().required(),
  proposedWindowStart: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  proposedWindowEnd: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  locationNote: Joi.string().optional(),
});

/**
 * Profile endpoint schemas
 */
export const updateProfileSchema = Joi.object({
  locationLat: Joi.number().min(-90).max(90).optional(),
  locationLng: Joi.number().min(-180).max(180).optional(),
  location_lat: Joi.number().min(-90).max(90).optional(),
  location_lng: Joi.number().min(-180).max(180).optional(),
  travelRadiusKm: Joi.number().positive().optional(),
  travel_radius_km: Joi.number().positive().optional(),
  games: Joi.array().items(Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana')).optional(),
  displayName: Joi.string().optional(),
  display_name: Joi.string().optional(),
});
