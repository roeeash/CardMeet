# Instruction 4: Events & Calendar System

## Overview
This instruction covers the complete events and calendar system including event discovery, RSVP management, geolocation-based filtering, and the calendar interface. This is the core coordination layer that enables users to find and commit to events where they can meet for trades.

## 4.1 Event Service Implementation

### Event Service
```typescript
// backend/src/services/EventService.ts
import { EventModel, EventRSVPModel } from '@models/Event';
import { UserProfileModel } from '@models/User';
import { Event, EventType, EventStatus, RSVPStatus } from '@shared/types/event';

export class EventService {
  static async findEventsForUser(userId: string): Promise<Event[]> {
    // Get user profile
    const profile = await UserProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Find nearby events within user's travel radius
    return EventModel.findNearbyEvents(
      profile.locationLat,
      profile.locationLng,
      profile.travelRadiusKm,
      profile.games
    );
  }

  static async findEventsWithSharedAttendance(
    userId: string,
    otherUserId: string
  ): Promise<Event[]> {
    return EventModel.findSharedEvents(userId, otherUserId);
  }

  static async createEvent(
    creatorId: string,
    eventData: {
      name: string;
      description?: string;
      locationName: string;
      locationLat: number;
      locationLng: number;
      startDate: Date;
      endDate: Date;
      games: string[];
      eventType: EventType;
    }
  ): Promise<Event> {
    // Validate event data
    if (eventData.startDate >= eventData.endDate) {
      throw new Error('Start date must be before end date');
    }

    if (eventData.startDate <= new Date()) {
      throw new Error('Start date must be in the future');
    }

    if (!eventData.games || eventData.games.length === 0) {
      throw new Error('At least one game must be specified');
    }

    const event = await EventModel.createEvent({
      ...eventData,
      status: EventStatus.ACTIVE,
      createdBy: creatorId,
    });

    // Auto-RSVP the creator as "going"
    await EventRSVPModel.setRSVP(creatorId, event.id, RSVPStatus.GOING);

    return event;
  }

  static async updateEvent(
    eventId: string,
    updateData: Partial<Event>,
    updaterId: string
  ): Promise<Event> {
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check if user is the creator
    if (event.createdBy !== updaterId) {
      throw new Error('Only event creator can update events');
    }

    // Don't allow updating past events
    if (event.startDate <= new Date()) {
      throw new Error('Cannot update past events');
    }

    return EventModel.update(eventId, updateData);
  }

  static async cancelEvent(eventId: string, cancelerId: string): Promise<Event> {
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check if user is the creator
    if (event.createdBy !== cancelerId) {
      throw new Error('Only event creator can cancel events');
    }

    return EventModel.update(eventId, { status: EventStatus.CANCELLED });
  }

  static async setEventRSVP(
    userId: string,
    eventId: string,
    status: RSVPStatus
  ): Promise<void> {
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== EventStatus.ACTIVE) {
      throw new Error('Cannot RSVP to inactive events');
    }

    if (event.startDate <= new Date()) {
      throw new Error('Cannot RSVP to past events');
    }

    await EventRSVPModel.setRSVP(userId, eventId, status);
  }

  static async getUserRSVPs(userId: string): Promise<{
    going: Event[];
    maybe: Event[];
    no: Event[];
  }> {
    const rsvps = await EventRSVPModel.getUserRSVPs(userId);
    
    const going = rsvps.filter(rsvp => rsvp.status === 'going');
    const maybe = rsvps.filter(rsvp => rsvp.status === 'maybe');
    const no = rsvps.filter(rsvp => rsvp.status === 'no');

    return { going, maybe, no };
  }

  static async getEventAttendees(eventId: string): Promise<any[]> {
    return EventRSVPModel.getEventAttendees(eventId);
  }

  static async searchEvents(query: {
    games?: string[];
    locationLat?: number;
    locationLng?: number;
    radiusKm?: number;
    startDate?: Date;
    endDate?: Date;
    eventType?: EventType;
    text?: string;
  }): Promise<Event[]> {
    let events: Event[] = [];

    if (query.locationLat && query.locationLng && query.radiusKm) {
      events = await EventModel.findNearbyEvents(
        query.locationLat,
        query.locationLng,
        query.radiusKm,
        query.games || [],
        query.startDate,
        query.endDate
      );
    } else {
      // If no location provided, search all events
      events = await EventModel.findMany({
        status: EventStatus.ACTIVE,
        ...(query.eventType && { event_type: query.eventType }),
        ...(query.games && query.games.length > 0 && { 
          where: function() {
            this.whereRaw('games && ?', [query.games]);
          }
        }),
      });
    }

    // Text search filter
    if (query.text) {
      events = events.filter(event => 
        event.name.toLowerCase().includes(query.text!.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(query.text!.toLowerCase()))
      );
    }

    return events;
  }
}
```

### Geolocation Service
```typescript
// backend/src/services/GeolocationService.ts
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  isWithinRadius: boolean;
}

export class GeolocationService {
  // Calculate distance between two points using Haversine formula
  static calculateDistance(
    point1: Coordinates,
    point2: Coordinates
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  static checkWithinRadius(
    center: Coordinates,
    point: Coordinates,
    radiusKm: number
  ): DistanceResult {
    const distance = this.calculateDistance(center, point);
    
    return {
      distanceKm: distance,
      isWithinRadius: distance <= radiusKm,
    };
  }

  // Find events within radius using PostGIS
  static async findEventsWithinRadius(
    userLat: number,
    userLng: number,
    radiusKm: number,
    filters: {
      games?: string[];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any[]> {
    // This would use the EventModel's geospatial query
    // Implementation is in EventModel.findNearbyEvents
    throw new Error('Use EventModel.findNearbyEvents instead');
  }

  // Geocode address to coordinates (using external service)
  static async geocodeAddress(address: string): Promise<Coordinates> {
    // In production, integrate with Google Maps API or similar
    // For now, return Tel Aviv coordinates as default
    return {
      lat: 32.0853,
      lng: 34.7818,
    };
  }

  // Reverse geocode coordinates to address
  static async reverseGeocode(lat: number, lng: number): Promise<string> {
    // In production, integrate with Google Maps API or similar
    return 'Tel Aviv, Israel';
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Validate coordinates
  static validateCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
}
```

## 4.2 Event Controller

### Event Controller
```typescript
// backend/src/controllers/events.ts
import { Request, Response } from 'express';
import { EventService } from '@services/EventService';
import { GeolocationService } from '@services/GeolocationService';
import { validate, schemas } from '@utils/validation';

export class EventController {
  static async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const events = await EventService.findEventsForUser(userId);
      
      res.json({ events });
    } catch (error) {
      console.error('Get events error:', error);
      res.status(500).json({ error: 'Failed to get events' });
    }
  }

  static async getEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const event = await EventModel.findById(eventId);

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      res.json({ event });
    } catch (error) {
      console.error('Get event error:', error);
      res.status(500).json({ error: 'Failed to get event' });
    }
  }

  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const eventData = req.body;

      const event = await EventService.createEvent(userId, eventData);
      
      res.status(201).json({ event });
    } catch (error) {
      console.error('Create event error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('validation')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to create event' });
        }
      } else {
        res.status(500).json({ error: 'Failed to create event' });
      }
    }
  }

  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      const event = await EventService.updateEvent(eventId, updateData, userId);
      
      res.json({ event });
    } catch (error) {
      console.error('Update event error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
        } else if (error.message.includes('Cannot update')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to update event' });
        }
      } else {
        res.status(500).json({ error: 'Failed to update event' });
      }
    }
  }

  static async cancelEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      const event = await EventService.cancelEvent(eventId, userId);
      
      res.json({ event });
    } catch (error) {
      console.error('Cancel event error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to cancel event' });
        }
      } else {
        res.status(500).json({ error: 'Failed to cancel event' });
      }
    }
  }

  static async setRSVP(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      await EventService.setEventRSVP(userId, eventId, status);
      
      res.json({ message: 'RSVP updated successfully' });
    } catch (error) {
      console.error('Set RSVP error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Cannot RSVP')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to set RSVP' });
        }
      } else {
        res.status(500).json({ error: 'Failed to set RSVP' });
      }
    }
  }

  static async getUserRSVPs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const rsvps = await EventService.getUserRSVPs(userId);
      
      res.json({ rsvps });
    } catch (error) {
      console.error('Get RSVPs error:', error);
      res.status(500).json({ error: 'Failed to get RSVPs' });
    }
  }

  static async getEventAttendees(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const attendees = await EventService.getEventAttendees(eventId);
      
      res.json({ attendees });
    } catch (error) {
      console.error('Get attendees error:', error);
      res.status(500).json({ error: 'Failed to get attendees' });
    }
  }

  static async searchEvents(req: Request, res: Response): Promise<void> {
    try {
      const searchQuery = req.query;
      
      const events = await EventService.searchEvents({
        games: searchQuery.games as string[] ? 
          (Array.isArray(searchQuery.games) ? searchQuery.games : [searchQuery.games]) : undefined,
        locationLat: searchQuery.lat ? parseFloat(searchQuery.lat as string) : undefined,
        locationLng: searchQuery.lng ? parseFloat(searchQuery.lng as string) : undefined,
        radiusKm: searchQuery.radius ? parseInt(searchQuery.radius as string) : undefined,
        startDate: searchQuery.startDate ? new Date(searchQuery.startDate as string) : undefined,
        endDate: searchQuery.endDate ? new Date(searchQuery.endDate as string) : undefined,
        eventType: searchQuery.eventType as EventType,
        text: searchQuery.q as string,
      });
      
      res.json({ events });
    } catch (error) {
      console.error('Search events error:', error);
      res.status(500).json({ error: 'Failed to search events' });
    }
  }

  static async getSharedEvents(req: Request, res: Response): Promise<void> {
    try {
      const { otherUserId } = req.params;
      const userId = req.user!.id;
      
      const events = await EventService.findEventsWithSharedAttendance(userId, otherUserId);
      
      res.json({ events });
    } catch (error) {
      console.error('Get shared events error:', error);
      res.status(500).json({ error: 'Failed to get shared events' });
    }
  }
}
```

### Event Validation Schemas
```typescript
// backend/src/utils/validation.ts (add to existing file)
export const schemas = {
  // ... existing schemas ...

  // Event creation validation
  createEvent: Joi.object({
    name: Joi.string()
      .min(3)
      .max(255)
      .required()
      .messages({
        'string.min': 'Event name must be at least 3 characters long',
        'string.max': 'Event name must be less than 255 characters',
        'any.required': 'Event name is required',
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Description must be less than 1000 characters',
      }),
    locationName: Joi.string()
      .min(3)
      .max(255)
      .required()
      .messages({
        'string.min': 'Location name must be at least 3 characters long',
        'string.max': 'Location name must be less than 255 characters',
        'any.required': 'Location name is required',
      }),
    locationLat: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.min': 'Invalid latitude',
        'number.max': 'Invalid latitude',
        'any.required': 'Latitude is required',
      }),
    locationLng: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.min': 'Invalid longitude',
        'number.max': 'Invalid longitude',
        'any.required': 'Longitude is required',
      }),
    startDate: Joi.date()
      .iso()
      .min('now')
      .required()
      .messages({
        'date.min': 'Start date must be in the future',
        'any.required': 'Start date is required',
      }),
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .required()
      .messages({
        'date.min': 'End date must be after start date',
        'any.required': 'End date is required',
      }),
    games: Joi.array()
      .items(Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana'))
      .min(1)
      .max(4)
      .required()
      .messages({
        'array.min': 'At least one game must be selected',
        'array.max': 'Maximum 4 games can be selected',
        'any.only': 'Invalid game selection',
        'any.required': 'Games are required',
      }),
    eventType: Joi.string()
      .valid('tournament', 'convention', 'fnm')
      .required()
      .messages({
        'any.only': 'Invalid event type',
        'any.required': 'Event type is required',
      }),
  }),

  // RSVP validation
  setRSVP: Joi.object({
    status: Joi.string()
      .valid('going', 'maybe', 'no')
      .required()
      .messages({
        'any.only': 'Invalid RSVP status',
        'any.required': 'RSVP status is required',
      }),
  }),

  // Event search validation
  searchEvents: Joi.object({
    games: Joi.array()
      .items(Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana'))
      .optional(),
    lat: Joi.number()
      .min(-90)
      .max(90)
      .optional(),
    lng: Joi.number()
      .min(-180)
      .max(180)
      .optional(),
    radius: Joi.number()
      .min(1)
      .max(500)
      .optional(),
    startDate: Joi.date()
      .iso()
      .optional(),
    endDate: Joi.date()
      .iso()
      .optional(),
    eventType: Joi.string()
      .valid('tournament', 'convention', 'fnm')
      .optional(),
    q: Joi.string()
      .max(100)
      .optional(),
  }),
};
```

## 4.3 Event Routes

### Event Routes
```typescript
// backend/src/routes/events.ts
import { Router } from 'express';
import { EventController } from '@controllers/events';
import { authenticate } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';

const router = Router();

// All event routes require authentication
router.use(authenticate);

// Get events for current user
router.get('/', EventController.getEvents);

// Search events
router.get('/search', validate(schemas.searchEvents), EventController.searchEvents);

// Get user's RSVPs
router.get('/rsvps', EventController.getUserRSVPs);

// Create event
router.post('/', validate(schemas.createEvent), EventController.createEvent);

// Get specific event
router.get('/:eventId', EventController.getEvent);

// Update event
router.put('/:eventId', validate(schemas.createEvent), EventController.updateEvent);

// Cancel event
router.delete('/:eventId/cancel', EventController.cancelEvent);

// Set RSVP for event
router.post('/:eventId/rsvp', validate(schemas.setRSVP), EventController.setRSVP);

// Get event attendees
router.get('/:eventId/attendees', EventController.getEventAttendees);

// Get shared events between users
router.get('/shared/:otherUserId', EventController.getSharedEvents);

export default router;
```

## 4.4 Frontend Event Service

### Event Service (Frontend)
```typescript
// frontend/src/services/events/EventService.ts
import { ApiClient } from '@services/api/ApiClient';
import { Event, EventType, RSVPStatus } from '@shared/types/event';

export interface EventSearchParams {
  games?: string[];
  lat?: number;
  lng?: number;
  radius?: number;
  startDate?: string;
  endDate?: string;
  eventType?: EventType;
  q?: string;
}

export interface UserRSVPs {
  going: Event[];
  maybe: Event[];
  no: Event[];
}

export class EventService {
  static async getEvents(): Promise<Event[]> {
    const response = await ApiClient.get<{ events: Event[] }>('/events');
    return response.events;
  }

  static async getEvent(eventId: string): Promise<Event> {
    const response = await ApiClient.get<{ event: Event }>(`/events/${eventId}`);
    return response.event;
  }

  static async createEvent(eventData: {
    name: string;
    description?: string;
    locationName: string;
    locationLat: number;
    locationLng: number;
    startDate: string;
    endDate: string;
    games: string[];
    eventType: EventType;
  }): Promise<Event> {
    const response = await ApiClient.post<{ event: Event }>('/events', eventData);
    return response.event;
  }

  static async updateEvent(
    eventId: string,
    updateData: Partial<Event>
  ): Promise<Event> {
    const response = await ApiClient.put<{ event: Event }>(`/events/${eventId}`, updateData);
    return response.event;
  }

  static async cancelEvent(eventId: string): Promise<Event> {
    const response = await ApiClient.delete<{ event: Event }>(`/events/${eventId}/cancel`);
    return response.event;
  }

  static async setRSVP(eventId: string, status: RSVPStatus): Promise<void> {
    await ApiClient.post(`/events/${eventId}/rsvp`, { status });
  }

  static async getUserRSVPs(): Promise<UserRSVPs> {
    const response = await ApiClient.get<{ rsvps: UserRSVPs }>('/events/rsvps');
    return response.rsvps;
  }

  static async getEventAttendees(eventId: string): Promise<any[]> {
    const response = await ApiClient.get<{ attendees: any[] }>(`/events/${eventId}/attendees`);
    return response.attendees;
  }

  static async searchEvents(params: EventSearchParams): Promise<Event[]> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });

    const response = await ApiClient.get<{ events: Event[] }>(`/events/search?${queryParams}`);
    return response.events;
  }

  static async getSharedEvents(otherUserId: string): Promise<Event[]> {
    const response = await ApiClient.get<{ events: Event[] }>(`/events/shared/${otherUserId}`);
    return response.events;
  }

  // Utility functions
  static formatEventDate(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Same day
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
    
    // Multi-day
    return `${start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} – ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`;
  }

  static formatEventTime(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return `${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })} – ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  static isEventUpcoming(startDate: string): boolean {
    return new Date(startDate) > new Date();
  }

  static isEventOngoing(startDate: string, endDate: string): boolean {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return now >= start && now <= end;
  }

  static isEventPast(endDate: string): boolean {
    return new Date(endDate) < new Date();
  }
}
```

## 4.5 Event Store (Redux)

### Event Store Slice
```typescript
// frontend/src/store/slices/eventSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { EventService, UserRSVPs } from '@services/events/EventService';
import { Event, RSVPStatus } from '@shared/types/event';

interface EventState {
  events: Event[];
  userRSVPs: UserRSVPs;
  selectedEvent: Event | null;
  loading: boolean;
  error: string | null;
  searchResults: Event[];
  searchLoading: boolean;
}

const initialState: EventState = {
  events: [],
  userRSVPs: {
    going: [],
    maybe: [],
    no: [],
  },
  selectedEvent: null,
  loading: false,
  error: null,
  searchResults: [],
  searchLoading: false,
};

// Async thunks
export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async () => {
    return await EventService.getEvents();
  }
);

export const fetchUserRSVPs = createAsyncThunk(
  'events/fetchUserRSVPs',
  async () => {
    return await EventService.getUserRSVPs();
  }
);

export const setEventRSVP = createAsyncThunk(
  'events/setRSVP',
  async ({ eventId, status }: { eventId: string; status: RSVPStatus }) => {
    await EventService.setRSVP(eventId, status);
    return { eventId, status };
  }
);

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async (eventData: any) => {
    return await EventService.createEvent(eventData);
  }
);

export const searchEvents = createAsyncThunk(
  'events/search',
  async (params: any) => {
    return await EventService.searchEvents(params);
  }
);

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedEvent: (state, action: PayloadAction<Event | null>) => {
      state.selectedEvent = action.payload;
    },
    updateEventInList: (state, action: PayloadAction<Event>) => {
      const index = state.events.findIndex(e => e.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch events
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch events';
      })
      // Fetch user RSVPs
      .addCase(fetchUserRSVPs.fulfilled, (state, action) => {
        state.userRSVPs = action.payload;
      })
      // Set RSVP
      .addCase(setEventRSVP.fulfilled, (state, action) => {
        const { eventId, status } = action.payload;
        
        // Update RSVPs
        state.userRSVPs.going = state.userRSVPs.going.filter(e => e.id !== eventId);
        state.userRSVPs.maybe = state.userRSVPs.maybe.filter(e => e.id !== eventId);
        state.userRSVPs.no = state.userRSVPs.no.filter(e => e.id !== eventId);
        
        // Add to appropriate list
        const event = state.events.find(e => e.id === eventId);
        if (event) {
          if (status === 'going') {
            state.userRSVPs.going.push(event);
          } else if (status === 'maybe') {
            state.userRSVPs.maybe.push(event);
          } else if (status === 'no') {
            state.userRSVPs.no.push(event);
          }
        }
      })
      // Create event
      .addCase(createEvent.fulfilled, (state, action) => {
        state.events.unshift(action.payload);
      })
      // Search events
      .addCase(searchEvents.pending, (state) => {
        state.searchLoading = true;
      })
      .addCase(searchEvents.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchEvents.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.error.message || 'Search failed';
      });
  },
});

export const { clearError, setSelectedEvent, updateEventInList, clearSearchResults } = eventSlice.actions;
export default eventSlice.reducer;
```

## 4.6 Calendar Screen Implementation

### Calendar Screen
```typescript
// frontend/src/screens/calendar/CalendarScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEvents, fetchUserRSVPs, setEventRSVP } from '@store/slices/eventSlice';
import { RootState } from '@store';
import { EventService } from '@services/events/EventService';
import { RSVPStatus } from '@shared/types/event';
import { Card } from '@components/common/Card/Card';
import { Text } from '@components/common/Text/Text';
import { Button } from '@components/common/Button/Button';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

export const CalendarScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { events, userRSVPs, loading } = useSelector((state: RootState) => state.events);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchEvents());
    dispatch(fetchUserRSVPs());
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchEvents()),
      dispatch(fetchUserRSVPs()),
    ]);
    setRefreshing(false);
  };

  const handleRSVP = async (eventId: string, status: RSVPStatus) => {
    try {
      await dispatch(setEventRSVP({ eventId, status })).unwrap();
    } catch (error) {
      console.error('Failed to set RSVP:', error);
    }
  };

  const getCurrentRSVPStatus = (eventId: string): RSVPStatus | null => {
    const allRSVPs = [...userRSVPs.going, ...userRSVPs.maybe, ...userRSVPs.no];
    const rsvp = allRSVPs.find(event => event.id === eventId);
    return rsvp ? (userRSVPs.going.includes(rsvp) ? 'going' : 
                   userRSVPs.maybe.includes(rsvp) ? 'maybe' : 'no') : null;
  };

  const renderEvent = ({ item }: { item: any }) => {
    const rsvpStatus = getCurrentRSVPStatus(item.id);
    
    return (
      <Card style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventDate}>
            {EventService.formatEventDate(item.startDate, item.endDate)}
          </Text>
          <Text style={styles.eventTime}>
            {EventService.formatEventTime(item.startDate, item.endDate)}
          </Text>
        </View>
        
        <Text style={styles.eventName}>{item.name}</Text>
        <Text style={styles.eventLocation}>📍 {item.locationName}</Text>
        
        <View style={styles.eventGames}>
          {item.games.map((game: string, index: number) => (
            <View key={index} style={styles.gameTag}>
              <Text style={styles.gameTagText}>{game.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.rsvpSection}>
          <Text style={styles.rsvpLabel}>RSVP:</Text>
          <View style={styles.rsvpButtons}>
            <Button
              title="Going"
              onPress={() => handleRSVP(item.id, 'going')}
              variant={rsvpStatus === 'going' ? 'primary' : 'secondary'}
              size="small"
              style={styles.rsvpButton}
            />
            <Button
              title="Maybe"
              onPress={() => handleRSVP(item.id, 'maybe')}
              variant={rsvpStatus === 'maybe' ? 'primary' : 'secondary'}
              size="small"
              style={styles.rsvpButton}
            />
            <Button
              title="No"
              onPress={() => handleRSVP(item.id, 'no')}
              variant={rsvpStatus === 'no' ? 'primary' : 'secondary'}
              size="small"
              style={styles.rsvpButton}
            />
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No events found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your travel radius or add a new event
      </Text>
      <Button
        title="Add Event"
        onPress={() => {/* Navigate to create event */}}
        style={styles.addButton}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  eventCard: {
    padding: spacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  eventDate: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.1,
  },
  eventTime: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
  },
  eventName: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h4.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  eventLocation: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
    marginBottom: spacing.md,
  },
  eventGames: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  gameTag: {
    backgroundColor: colors.paper2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  gameTagText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.ink2,
    fontWeight: typography.weights.semibold,
  },
  rsvpSection: {
    marginTop: spacing.md,
  },
  rsvpLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rsvpButton: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h3.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  addButton: {
    paddingHorizontal: spacing.xxl,
  },
});
```

### Event Detail Screen
```typescript
// frontend/src/screens/calendar/EventDetailScreen.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp, useRoute } from '@react-navigation/native';
import { setSelectedEvent, setEventRSVP } from '@store/slices/eventSlice';
import { RootState } from '@store';
import { RSVPStatus } from '@shared/types/event';
import { Card } from '@components/common/Card/Card';
import { Text } from '@components/common/Text/Text';
import { Button } from '@components/common/Button/Button';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

type EventDetailRouteProp = RouteProp<any, 'EventDetail'>;

export const EventDetailScreen: React.FC = () => {
  const dispatch = useDispatch();
  const route = useRoute<EventDetailRouteProp>();
  const { eventId } = route.params;
  const { selectedEvent, userRSVPs } = useSelector((state: RootState) => state.events);

  useEffect(() => {
    // In a real app, you'd fetch the event details here
    // For now, assume it's already loaded
  }, [eventId]);

  const handleRSVP = async (status: RSVPStatus) => {
    try {
      await dispatch(setEventRSVP({ eventId, status })).unwrap();
    } catch (error) {
      console.error('Failed to set RSVP:', error);
    }
  };

  const getCurrentRSVPStatus = (): RSVPStatus | null => {
    if (!selectedEvent) return null;
    
    const allRSVPs = [...userRSVPs.going, ...userRSVPs.maybe, ...userRSVPs.no];
    const rsvp = allRSVPs.find(event => event.id === selectedEvent.id);
    return rsvp ? (userRSVPs.going.includes(rsvp) ? 'going' : 
                   userRSVPs.maybe.includes(rsvp) ? 'maybe' : 'no') : null;
  };

  if (!selectedEvent) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading event...</Text>
      </View>
    );
  }

  const rsvpStatus = getCurrentRSVPStatus();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.eventName}>{selectedEvent.name}</Text>
        <Text style={styles.eventType}>
          {selectedEvent.eventType.toUpperCase()}
        </Text>
      </View>

      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>WHEN</Text>
          <Text style={styles.detailValue}>
            {EventService.formatEventDate(selectedEvent.startDate, selectedEvent.endDate)}
          </Text>
          <Text style={styles.detailSubValue}>
            {EventService.formatEventTime(selectedEvent.startDate, selectedEvent.endDate)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>WHERE</Text>
          <Text style={styles.detailValue}>{selectedEvent.locationName}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>GAMES</Text>
          <View style={styles.gamesContainer}>
            {selectedEvent.games.map((game: string, index: number) => (
              <View key={index} style={styles.gameTag}>
                <Text style={styles.gameTagText}>{game.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {selectedEvent.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ABOUT</Text>
            <Text style={styles.detailValue}>{selectedEvent.description}</Text>
          </View>
        )}
      </Card>

      <Card style={styles.rsvpCard}>
        <Text style={styles.rsvpTitle}>Will you attend?</Text>
        <View style={styles.rsvpButtons}>
          <Button
            title="Going"
            onPress={() => handleRSVP('going')}
            variant={rsvpStatus === 'going' ? 'primary' : 'secondary'}
            style={styles.rsvpButton}
          />
          <Button
            title="Maybe"
            onPress={() => handleRSVP('maybe')}
            variant={rsvpStatus === 'maybe' ? 'primary' : 'secondary'}
            style={styles.rsvpButton}
          />
          <Button
            title="No"
            onPress={() => handleRSVP('no')}
            variant={rsvpStatus === 'no' ? 'primary' : 'secondary'}
            style={styles.rsvpButton}
          />
        </View>
      </Card>

      <Card style={styles.attendeesCard}>
        <Text style={styles.attendeesTitle}>Who's going</Text>
        <Text style={styles.attendeesCount}>
          {/* This would show actual attendee count */}
          Loading attendees...
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  eventName: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h2.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  eventType: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.1,
  },
  detailsCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  detailRow: {
    marginBottom: spacing.lg,
  },
  detailLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.1,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink,
    fontWeight: typography.weights.semibold,
  },
  detailSubValue: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
    marginTop: spacing.xs,
  },
  gamesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gameTag: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  gameTagText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  rsvpCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  rsvpTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h3.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rsvpButton: {
    flex: 1,
  },
  attendeesCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  attendeesTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h3.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  attendeesCount: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
});
```

## 4.7 Create Event Screen

### Create Event Screen
```typescript
// frontend/src/screens/calendar/CreateEventScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { createEvent } from '@store/slices/eventSlice';
import { EventType } from '@shared/types/event';
import { Button } from '@components/common/Button/Button';
import { Card } from '@components/common/Card/Card';
import { Input } from '@components/common/Input/Input';
import { Text } from '@components/common/Text/Text';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

export const CreateEventScreen: React.FC = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    locationName: '',
    locationLat: 32.0853, // Default Tel Aviv
    locationLng: 34.7818,
    startDate: '',
    endDate: '',
    games: [] as string[],
    eventType: 'tournament' as EventType,
  });

  const handleCreateEvent = async () => {
    // Validation
    if (!formData.name || !formData.locationName || !formData.startDate || 
        !formData.endDate || formData.games.length === 0) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    if (new Date(formData.startDate) <= new Date()) {
      Alert.alert('Error', 'Start date must be in the future');
      return;
    }

    setLoading(true);
    try {
      await dispatch(createEvent(formData)).unwrap();
      // Navigate back to calendar
      // navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const toggleGame = (game: string) => {
    setFormData(prev => ({
      ...prev,
      games: prev.games.includes(game)
        ? prev.games.filter(g => g !== game)
        : [...prev.games, game],
    }));
  };

  const games = [
    { id: 'mtg', name: 'Magic: The Gathering' },
    { id: 'pokemon', name: 'Pokémon' },
    { id: 'yugioh', name: 'Yu-Gi-Oh!' },
    { id: 'lorcana', name: 'Lorcana' },
  ];

  const eventTypes = [
    { id: 'tournament', name: 'Tournament' },
    { id: 'convention', name: 'Convention' },
    { id: 'fnm', name: 'FNM' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Event</Text>
        <Text style={styles.subtitle}>
          Add a new tournament, convention, or FNM
        </Text>
      </View>

      <Card style={styles.formCard}>
        <Input
          label="Event Name"
          value={formData.name}
          onChangeText={(name) => setFormData(prev => ({ ...prev, name }))}
          placeholder="e.g., FNM at Freaks"
        />

        <Input
          label="Location"
          value={formData.locationName}
          onChangeText={(locationName) => setFormData(prev => ({ ...prev, locationName }))}
          placeholder="e.g., Freaks Game Store, Tel Aviv"
          style={styles.input}
        />

        <View style={styles.dateRow}>
          <View style={styles.dateInput}>
            <Input
              label="Start Date & Time"
              value={formData.startDate}
              onChangeText={(startDate) => setFormData(prev => ({ ...prev, startDate }))}
              placeholder="2026-05-09T19:00"
            />
          </View>
          <View style={styles.dateInput}>
            <Input
              label="End Date & Time"
              value={formData.endDate}
              onChangeText={(endDate) => setFormData(prev => ({ ...prev, endDate }))}
              placeholder="2026-05-09T23:00"
            />
          </View>
        </View>

        <Input
          label="Description (Optional)"
          value={formData.description}
          onChangeText={(description) => setFormData(prev => ({ ...prev, description }))}
          placeholder="Event details, format, prizes..."
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Type</Text>
          <View style={styles.buttonRow}>
            {eventTypes.map((type) => (
              <Button
                key={type.id}
                title={type.name}
                onPress={() => setFormData(prev => ({ ...prev, eventType: type.id as EventType }))}
                variant={formData.eventType === type.id ? 'primary' : 'secondary'}
                size="small"
                style={styles.typeButton}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Games</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply</Text>
          <View style={styles.gameGrid}>
            {games.map((game) => (
              <Button
                key={game.id}
                title={game.name}
                onPress={() => toggleGame(game.id)}
                variant={formData.games.includes(game.id) ? 'primary' : 'secondary'}
                size="small"
                style={styles.gameButton}
              />
            ))}
          </View>
        </View>

        <Button
          title="Create Event"
          onPress={handleCreateEvent}
          loading={loading}
          style={styles.createButton}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h2.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
  formCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  input: {
    marginTop: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dateInput: {
    flex: 1,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h4.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gameButton: {
    minWidth: '45%',
  },
  createButton: {
    marginTop: spacing.xxl,
  },
});
```

## 4.8 Testing Event System

### Event Service Tests
```typescript
// backend/tests/services/EventService.test.ts
import { EventService } from '../../src/services/EventService';
import { Database } from '../../src/config/database';

describe('EventService', () => {
  let testUser: any;
  let testEvent: any;

  beforeAll(async () => {
    await Database.migrate();
    
    // Create test user
    testUser = await UserModel.create({
      email: 'eventtest@example.com',
      password: 'password123',
    });

    await UserProfileModel.createProfile({
      userId: testUser.id,
      displayName: 'Event Test User',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg'],
    });
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('createEvent', () => {
    it('should create an event successfully', async () => {
      const eventData = {
        name: 'Test Tournament',
        description: 'A test tournament',
        locationName: 'Test Location',
        locationLat: 32.0853,
        locationLng: 34.7818,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours later
        games: ['mtg'],
        eventType: 'tournament' as const,
      };

      testEvent = await EventService.createEvent(testUser.id, eventData);

      expect(testEvent.name).toBe(eventData.name);
      expect(testEvent.createdBy).toBe(testUser.id);
      expect(testEvent.status).toBe('active');
    });

    it('should reject events with start date in the past', async () => {
      const eventData = {
        name: 'Past Event',
        locationName: 'Test Location',
        locationLat: 32.0853,
        locationLng: 34.7818,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        games: ['mtg'],
        eventType: 'tournament' as const,
      };

      await expect(EventService.createEvent(testUser.id, eventData))
        .rejects.toThrow('Start date must be in the future');
    });

    it('should reject events with invalid date range', async () => {
      const eventData = {
        name: 'Invalid Date Event',
        locationName: 'Test Location',
        locationLat: 32.0853,
        locationLng: 34.7818,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // Before start
        games: ['mtg'],
        eventType: 'tournament' as const,
      };

      await expect(EventService.createEvent(testUser.id, eventData))
        .rejects.toThrow('Start date must be before end date');
    });
  });

  describe('setEventRSVP', () => {
    it('should set RSVP successfully', async () => {
      await EventService.setEventRSVP(testUser.id, testEvent.id, 'going');

      const rsvps = await EventService.getUserRSVPs(testUser.id);
      expect(rsvps.going).toHaveLength(1);
      expect(rsvps.going[0].id).toBe(testEvent.id);
    });

    it('should update RSVP status', async () => {
      await EventService.setEventRSVP(testUser.id, testEvent.id, 'maybe');

      const rsvps = await EventService.getUserRSVPs(testUser.id);
      expect(rsvps.going).toHaveLength(0);
      expect(rsvps.maybe).toHaveLength(1);
      expect(rsvps.maybe[0].id).toBe(testEvent.id);
    });

    it('should reject RSVP for past events', async () => {
      // Create a past event
      const pastEvent = await EventModel.createEvent({
        name: 'Past Event',
        locationName: 'Test Location',
        locationLat: 32.0853,
        locationLng: 34.7818,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 20 * 60 * 60 * 1000),
        games: ['mtg'],
        eventType: 'tournament',
        status: 'active',
      });

      await expect(EventService.setEventRSVP(testUser.id, pastEvent.id, 'going'))
        .rejects.toThrow('Cannot RSVP to past events');
    });
  });

  describe('findEventsForUser', () => {
    it('should find events within user radius', async () => {
      const events = await EventService.findEventsForUser(testUser.id);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].games).toContain('mtg');
    });
  });
});
```

## Verification Checklist

- [ ] Event service with geospatial queries implemented
- [ ] RSVP management with proper validation
- [ ] Event creation with validation rules
- [ ] Event controller with comprehensive endpoints
- [ ] Geolocation service with distance calculations
- [ ] Frontend event service with API integration
- [ ] Redux store for event state management
- [ ] Calendar screen with RSVP functionality
- [ ] Event detail screen with full information
- [ ] Create event screen with form validation
- [ ] Date formatting and utility functions
- [ ] Event search functionality
- [ ] Shared event detection between users
- [ ] Comprehensive test coverage
- [ ] Proper error handling and validation

## Next Steps

Proceed to **Instruction 5: Listings & Browse System** to implement the card listing creation, browsing with shared event indicators, and the core marketplace functionality that connects buyers and sellers.
