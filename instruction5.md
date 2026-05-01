# Instruction 5: Listings & Browse System

## Overview
This instruction covers the complete listings and browse system including card listing creation, browsing with shared event indicators, filtering and search functionality, and the core marketplace features that connect buyers and sellers.

**Note**: Frontend components already exist in `/frontend/Components/Browse.jsx` and `/frontend/Components/Listing.jsx`. These need to be migrated to React Native and integrated with the backend API.

## 5.1 Listing Service Implementation

### Listing Service
```typescript
// backend/src/services/ListingService.ts
import { ListingModel } from '@models/Listing';
import { UserProfileModel } from '@models/User';
import { EventModel, EventRSVPModel } from '@models/Event';
import { Listing, Game, ListingStatus, CardCondition } from '@shared/types/listing';

export interface ListingFilters {
  games?: Game[];
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  sharedEventsOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  condition?: CardCondition[];
  sellerId?: string;
  cardName?: string;
  cardSet?: string;
}

export interface ListingSearchResult {
  listing: Listing;
  seller: {
    displayName: string;
    rating: number;
    completedDeals: number;
    noShows: number;
  };
  sharedEvents?: Array<{
    id: string;
    name: string;
    startDate: Date;
    locationName: string;
  }>;
}

export class ListingService {
  static async createListing(
    sellerId: string,
    listingData: {
      cardName: string;
      cardSet?: string;
      condition: CardCondition;
      priceCents: number;
      currency?: string;
      description?: string;
      game: Game;
      imageUrl?: string;
    }
  ): Promise<ListingSearchResult> {
    // Validate listing data
    if (listingData.priceCents <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (listingData.priceCents > 10000000) { // ₪100,000 max
      throw new Error('Price exceeds maximum allowed amount');
    }

    if (!listingData.cardName || listingData.cardName.trim().length < 2) {
      throw new Error('Card name is required');
    }

    const listing = await ListingModel.createListing({
      ...listingData,
      sellerId,
      currency: listingData.currency || 'ILS',
      status: ListingStatus.ACTIVE,
    });

    // Get seller profile
    const sellerProfile = await UserProfileModel.findByUserId(sellerId);
    if (!sellerProfile) {
      throw new Error('Seller profile not found');
    }

    return {
      listing,
      seller: {
        displayName: sellerProfile.displayName,
        rating: sellerProfile.rating,
        completedDeals: sellerProfile.completedDeals,
        noShows: sellerProfile.noShows,
      },
    };
  }

  static async findListingsForUser(
    userId: string,
    filters: ListingFilters = {}
  ): Promise<ListingSearchResult[]> {
    // Get user profile for location and preferences
    const userProfile = await UserProfileModel.findByUserId(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Prepare filters with user's location
    const searchFilters: any = {
      games: filters.games || userProfile.games,
      locationLat: filters.locationLat || userProfile.locationLat,
      locationLng: filters.locationLng || userProfile.locationLng,
      radiusKm: filters.radiusKm || userProfile.travelRadiusKm,
      sharedEventsOnly: filters.sharedEventsOnly,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      condition: filters.condition,
      cardName: filters.cardName,
      cardSet: filters.cardSet,
    };

    // Find listings
    const listings = await ListingModel.findListingsForUser(userId, searchFilters);

    // Enrich with seller info and shared events
    const results: ListingSearchResult[] = [];
    
    for (const listing of listings) {
      const sellerProfile = await UserProfileModel.findByUserId(listing.sellerId);
      if (!sellerProfile) continue;

      let sharedEvents;
      if (searchFilters.sharedEventsOnly) {
        sharedEvents = await EventModel.findSharedEvents(userId, listing.sellerId);
      }

      results.push({
        listing,
        seller: {
          displayName: sellerProfile.displayName,
          rating: sellerProfile.rating,
          completedDeals: sellerProfile.completedDeals,
          noShows: sellerProfile.noShows,
        },
        sharedEvents,
      });
    }

    return results;
  }

  static async getListingDetail(listingId: string, userId?: string): Promise<ListingSearchResult> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new Error('Listing is not active');
    }

    const sellerProfile = await UserProfileModel.findByUserId(listing.sellerId);
    if (!sellerProfile) {
      throw new Error('Seller profile not found');
    }

    let sharedEvents;
    if (userId) {
      sharedEvents = await EventModel.findSharedEvents(userId, listing.sellerId);
    }

    return {
      listing,
      seller: {
        displayName: sellerProfile.displayName,
        rating: sellerProfile.rating,
        completedDeals: sellerProfile.completedDeals,
        noShows: sellerProfile.noShows,
      },
      sharedEvents,
    };
  }

  static async updateListing(
    listingId: string,
    sellerId: string,
    updateData: Partial<Listing>
  ): Promise<ListingSearchResult> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new Error('Only seller can update listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new Error('Cannot update inactive listing');
    }

    // Validate price if being updated
    if (updateData.priceCents !== undefined) {
      if (updateData.priceCents <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (updateData.priceCents > 10000000) {
        throw new Error('Price exceeds maximum allowed amount');
      }
    }

    const updatedListing = await ListingModel.updateListing(listingId, updateData);

    const sellerProfile = await UserProfileModel.findByUserId(sellerId);
    if (!sellerProfile) {
      throw new Error('Seller profile not found');
    }

    return {
      listing: updatedListing,
      seller: {
        displayName: sellerProfile.displayName,
        rating: sellerProfile.rating,
        completedDeals: sellerProfile.completedDeals,
        noShows: sellerProfile.noShows,
      },
    };
  }

  static async withdrawListing(listingId: string, sellerId: string): Promise<void> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new Error('Only seller can withdraw listing');
    }

    await ListingModel.updateListingStatus(listingId, ListingStatus.WITHDRAWN);
  }

  static async markListingSold(listingId: string, sellerId: string): Promise<void> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new Error('Only seller can mark listing as sold');
    }

    await ListingModel.updateListingStatus(listingId, ListingStatus.SOLD);
  }

  static async getSellerListings(sellerId: string): Promise<ListingSearchResult[]> {
    const listings = await ListingModel.getSellerListings(sellerId);

    const sellerProfile = await UserProfileModel.findByUserId(sellerId);
    if (!sellerProfile) {
      throw new Error('Seller profile not found');
    }

    return listings.map(listing => ({
      listing,
      seller: {
        displayName: sellerProfile.displayName,
        rating: sellerProfile.rating,
        completedDeals: sellerProfile.completedDeals,
        noShows: sellerProfile.noShows,
      },
    }));
  }

  static async searchListings(query: {
    text?: string;
    games?: Game[];
    minPrice?: number;
    maxPrice?: number;
    condition?: CardCondition[];
    locationLat?: number;
    locationLng?: number;
    radiusKm?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ results: ListingSearchResult[]; total: number; hasMore: boolean }> {
    // This would implement full-text search across card names and sets
    // For now, use the existing findListingsForUser with text filter
    const filters: ListingFilters = {
      games: query.games,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      condition: query.condition,
      locationLat: query.locationLat,
      locationLng: query.locationLng,
      radiusKm: query.radiusKm,
      cardName: query.text,
    };

    // For search, we don't filter by seller (show all listings)
    const listings = await ListingModel.findListingsForUser('search-user', filters);
    
    // Remove the seller filter from the SQL query by modifying the model
    // This is a simplified approach - in production, you'd have a dedicated search method

    const results: ListingSearchResult[] = [];
    
    for (const listing of listings.slice(query.offset || 0, (query.offset || 0) + (query.limit || 20))) {
      const sellerProfile = await UserProfileModel.findByUserId(listing.sellerId);
      if (!sellerProfile) continue;

      results.push({
        listing,
        seller: {
          displayName: sellerProfile.displayName,
          rating: sellerProfile.rating,
          completedDeals: sellerProfile.completedDeals,
          noShows: sellerProfile.noShows,
        },
      });
    }

    return {
      results,
      total: listings.length,
      hasMore: (query.offset || 0) + (query.limit || 20) < listings.length,
    };
  }
}
```

## 5.2 Listing Controller

### Listing Controller
```typescript
// backend/src/controllers/listings.ts
import { Request, Response } from 'express';
import { ListingService } from '@services/ListingService';
import { validate, schemas } from '@utils/validation';
import { uploadCardImage } from '@middleware/upload';

export class ListingController {
  static async getListings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const filters = req.query;

      const listings = await ListingService.findListingsForUser(userId, {
        games: filters.games as string[] ? 
          (Array.isArray(filters.games) ? filters.games : [filters.games]) : undefined,
        sharedEventsOnly: filters.sharedEventsOnly === 'true',
        minPrice: filters.minPrice ? parseFloat(filters.minPrice as string) : undefined,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice as string) : undefined,
        condition: filters.condition as string[] ? 
          (Array.isArray(filters.condition) ? filters.condition : [filters.condition]) : undefined,
        cardName: filters.cardName as string,
        cardSet: filters.cardSet as string,
      });

      res.json({ listings });
    } catch (error) {
      console.error('Get listings error:', error);
      res.status(500).json({ error: 'Failed to get listings' });
    }
  }

  static async getListing(req: Request, res: Response): Promise<void> {
    try {
      const { listingId } = req.params;
      const userId = req.user!.id;

      const listing = await ListingService.getListingDetail(listingId, userId);

      res.json({ listing });
    } catch (error) {
      console.error('Get listing error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
        } else if (error.message.includes('not active')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to get listing' });
        }
      } else {
        res.status(500).json({ error: 'Failed to get listing' });
      }
    }
  }

  static async createListing(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const listingData = req.body;

      // Handle image upload if present
      if (req.file) {
        // TODO: Upload to S3 and get URL
        // For now, use placeholder
        listingData.imageUrl = `https://cardmeet-uploads.s3.amazonaws.com/cards/${userId}/${req.file.filename}`;
      }

      const listing = await ListingService.createListing(userId, listingData);

      res.status(201).json({ listing });
    } catch (error) {
      console.error('Create listing error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('validation')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to create listing' });
        }
      } else {
        res.status(500).json({ error: 'Failed to create listing' });
      }
    }
  }

  static async updateListing(req: Request, res: Response): Promise<void> {
    try {
      const { listingId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      const listing = await ListingService.updateListing(listingId, userId, updateData);

      res.json({ listing });
    } catch (error) {
      console.error('Update listing error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
        } else if (error.message.includes('Cannot update')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to update listing' });
        }
      } else {
        res.status(500).json({ error: 'Failed to update listing' });
      }
    }
  }

  static async withdrawListing(req: Request, res: Response): Promise<void> {
    try {
      const { listingId } = req.params;
      const userId = req.user!.id;

      await ListingService.withdrawListing(listingId, userId);

      res.json({ message: 'Listing withdrawn successfully' });
    } catch (error) {
      console.error('Withdraw listing error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to withdraw listing' });
        }
      } else {
        res.status(500).json({ error: 'Failed to withdraw listing' });
      }
    }
  }

  static async markListingSold(req: Request, res: Response): Promise<void> {
    try {
      const { listingId } = req.params;
      const userId = req.user!.id;

      await ListingService.markListingSold(listingId, userId);

      res.json({ message: 'Listing marked as sold' });
    } catch (error) {
      console.error('Mark sold error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to mark listing as sold' });
        }
      } else {
        res.status(500).json({ error: 'Failed to mark listing as sold' });
      }
    }
  }

  static async getSellerListings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const listings = await ListingService.getSellerListings(userId);

      res.json({ listings });
    } catch (error) {
      console.error('Get seller listings error:', error);
      res.status(500).json({ error: 'Failed to get seller listings' });
    }
  }

  static async searchListings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = req.query;

      // Get user profile for location
      const userProfile = await UserProfileModel.findByUserId(userId);
      if (!userProfile) {
        res.status(404).json({ error: 'User profile not found' });
        return;
      }

      const searchResults = await ListingService.searchListings({
        text: query.q as string,
        games: query.games as string[] ? 
          (Array.isArray(query.games) ? query.games : [query.games]) : undefined,
        minPrice: query.minPrice ? parseFloat(query.minPrice as string) : undefined,
        maxPrice: query.maxPrice ? parseFloat(query.maxPrice as string) : undefined,
        condition: query.condition as string[] ? 
          (Array.isArray(query.condition) ? query.condition : [query.condition]) : undefined,
        locationLat: userProfile.locationLat,
        locationLng: userProfile.locationLng,
        radiusKm: userProfile.travelRadiusKm,
        limit: query.limit ? parseInt(query.limit as string) : 20,
        offset: query.offset ? parseInt(query.offset as string) : 0,
      });

      res.json(searchResults);
    } catch (error) {
      console.error('Search listings error:', error);
      res.status(500).json({ error: 'Failed to search listings' });
    }
  }
}
```

### Listing Validation Schemas
```typescript
// backend/src/utils/validation.ts (add to existing file)
export const schemas = {
  // ... existing schemas ...

  // Listing creation validation
  createListing: Joi.object({
    cardName: Joi.string()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.min': 'Card name must be at least 2 characters long',
        'string.max': 'Card name must be less than 255 characters',
        'any.required': 'Card name is required',
      }),
    cardSet: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Card set must be less than 100 characters',
      }),
    condition: Joi.string()
      .valid('nm', 'lp', 'mp', 'hp')
      .required()
      .messages({
        'any.only': 'Invalid condition',
        'any.required': 'Condition is required',
      }),
    priceCents: Joi.number()
      .integer()
      .min(100)
      .max(10000000)
      .required()
      .messages({
        'number.min': 'Price must be at least ₪1',
        'number.max': 'Price cannot exceed ₪10,000',
        'any.required': 'Price is required',
      }),
    currency: Joi.string()
      .valid('ILS', 'USD', 'EUR')
      .default('ILS'),
    description: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Description must be less than 1000 characters',
      }),
    game: Joi.string()
      .valid('mtg', 'pokemon', 'yugioh', 'lorcana')
      .required()
      .messages({
        'any.only': 'Invalid game',
        'any.required': 'Game is required',
      }),
    imageUrl: Joi.string()
      .uri()
      .optional(),
  }),

  // Listing update validation
  updateListing: Joi.object({
    cardName: Joi.string()
      .min(2)
      .max(255)
      .optional(),
    cardSet: Joi.string()
      .max(100)
      .optional(),
    condition: Joi.string()
      .valid('nm', 'lp', 'mp', 'hp')
      .optional(),
    priceCents: Joi.number()
      .integer()
      .min(100)
      .max(10000000)
      .optional(),
    description: Joi.string()
      .max(1000)
      .optional(),
    imageUrl: Joi.string()
      .uri()
      .optional(),
  }),

  // Search validation
  searchListings: Joi.object({
    q: Joi.string()
      .max(100)
      .optional(),
    games: Joi.array()
      .items(Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana'))
      .optional(),
    minPrice: Joi.number()
      .min(0)
      .optional(),
    maxPrice: Joi.number()
      .min(0)
      .optional(),
    condition: Joi.array()
      .items(Joi.string().valid('nm', 'lp', 'mp', 'hp'))
      .optional(),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0),
  }),
};
```

## 5.3 Listing Routes

### Listing Routes
```typescript
// backend/src/routes/listings.ts
import { Router } from 'express';
import { ListingController } from '@controllers/listings';
import { authenticate } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';
import { uploadCardImage } from '@middleware/upload';

const router = Router();

// All listing routes require authentication
router.use(authenticate);

// Get listings for current user
router.get('/', ListingController.getListings);

// Search listings
router.get('/search', validate(schemas.searchListings), ListingController.searchListings);

// Get seller's listings
router.get('/my-listings', ListingController.getSellerListings);

// Create listing (with image upload)
router.post(
  '/',
  uploadCardImage.single('image'),
  validate(schemas.createListing),
  ListingController.createListing
);

// Get specific listing
router.get('/:listingId', ListingController.getListing);

// Update listing
router.put(
  '/:listingId',
  validate(schemas.updateListing),
  ListingController.updateListing
);

// Withdraw listing
router.delete('/:listingId/withdraw', ListingController.withdrawListing);

// Mark listing as sold
router.put('/:listingId/sold', ListingController.markListingSold);

export default router;
```

## 5.4 Frontend Listing Service (React Native)

### Listing Service (Frontend)
```typescript
// frontend/src/services/listings/ListingService.ts
import { ApiClient } from '@services/api/ApiClient';
import { Listing, Game, CardCondition, ListingStatus } from '@shared/types/listing';

export interface ListingFilters {
  games?: Game[];
  sharedEventsOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  condition?: CardCondition[];
  cardName?: string;
  cardSet?: string;
}

export interface ListingSearchResult {
  listing: Listing;
  seller: {
    displayName: string;
    rating: number;
    completedDeals: number;
    noShows: number;
  };
  sharedEvents?: Array<{
    id: string;
    name: string;
    startDate: string;
    locationName: string;
  }>;
}

export interface SearchResults {
  results: ListingSearchResult[];
  total: number;
  hasMore: boolean;
}

export class ListingService {
  static async getListings(filters: ListingFilters = {}): Promise<ListingSearchResult[]> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });

    const response = await ApiClient.get<{ listings: ListingSearchResult[] }>(
      `/listings?${queryParams}`
    );
    return response.listings;
  }

  static async getListing(listingId: string): Promise<ListingSearchResult> {
    const response = await ApiClient.get<{ listing: ListingSearchResult }>(`/listings/${listingId}`);
    return response.listing;
  }

  static async createListing(
    listingData: {
      cardName: string;
      cardSet?: string;
      condition: CardCondition;
      priceCents: number;
      description?: string;
      game: Game;
    },
    imageFile?: File
  ): Promise<ListingSearchResult> {
    if (imageFile) {
      const response = await ApiClient.upload<{ listing: ListingSearchResult }>(
        '/listings',
        imageFile,
        listingData
      );
      return response.listing;
    } else {
      const response = await ApiClient.post<{ listing: ListingSearchResult }>(
        '/listings',
        listingData
      );
      return response.listing;
    }
  }

  static async updateListing(
    listingId: string,
    updateData: Partial<Listing>
  ): Promise<ListingSearchResult> {
    const response = await ApiClient.put<{ listing: ListingSearchResult }>(
      `/listings/${listingId}`,
      updateData
    );
    return response.listing;
  }

  static async withdrawListing(listingId: string): Promise<void> {
    await ApiClient.delete(`/listings/${listingId}/withdraw`);
  }

  static async markListingSold(listingId: string): Promise<void> {
    await ApiClient.put(`/listings/${listingId}/sold`);
  }

  static async getSellerListings(): Promise<ListingSearchResult[]> {
    const response = await ApiClient.get<{ listings: ListingSearchResult[] }>('/listings/my-listings');
    return response.listings;
  }

  static async searchListings(query: {
    text?: string;
    games?: Game[];
    minPrice?: number;
    maxPrice?: number;
    condition?: CardCondition[];
    limit?: number;
    offset?: number;
  }): Promise<SearchResults> {
    const queryParams = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });

    const response = await ApiClient.get<SearchResults>(`/listings/search?${queryParams}`);
    return response;
  }

  // Utility functions
  static formatPrice(priceCents: number, currency = 'ILS'): string {
    const price = priceCents / 100;
    const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';
    return `${symbol}${price.toLocaleString()}`;
  }

  static formatCondition(condition: CardCondition): string {
    switch (condition) {
      case 'nm': return 'Near Mint';
      case 'lp': return 'Lightly Played';
      case 'mp': return 'Moderately Played';
      case 'hp': return 'Heavily Played';
      default: return condition.toUpperCase();
    }
  }

  static getConditionDescription(condition: CardCondition): string {
    switch (condition) {
      case 'nm': return 'Pack-fresh or close to it. Minimal handling marks if any.';
      case 'lp': return 'Light play wear. Edges and surface mostly clean.';
      case 'mp': return 'Visible play wear, no creases or major damage.';
      case 'hp': return 'Significant play wear, may have minor creases.';
      default: return '';
    }
  }

  static hasSharedEvents(listing: ListingSearchResult): boolean {
    return !!(listing.sharedEvents && listing.sharedEvents.length > 0);
  }

  static getPrimarySharedEvent(listing: ListingSearchResult) {
    if (!listing.sharedEvents || listing.sharedEvents.length === 0) return null;
    
    // Return the soonest upcoming event
    return listing.sharedEvents
      .filter(event => new Date(event.startDate) > new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
  }
}
```

## 5.5 Browse Screen (React Native Migration)

### Browse Screen
```typescript
// frontend/src/screens/browse/BrowseScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchListings } from '@store/slices/listingSlice';
import { RootState } from '@store';
import { ListingService, ListingFilters } from '@services/listings/ListingService';
import { Card } from '@components/common/Card/Card';
import { Text } from '@components/common/Text/Text';
import { Button } from '@components/common/Button/Button';
import { Input } from '@components/common/Input/Input';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

// MIGRATED from /frontend/Components/Browse.jsx
export const BrowseScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { listings, loading } = useSelector((state: RootState) => state.listings);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('shared');

  useEffect(() => {
    dispatch(fetchListings({ sharedEventsOnly: true }));
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchListings({ sharedEventsOnly: true }));
    setRefreshing(false);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    
    let filters: ListingFilters = {};
    
    switch (filter) {
      case 'shared':
        filters.sharedEventsOnly = true;
        break;
      case 'mtg':
        filters.games = ['mtg'];
        break;
      case 'pokemon':
        filters.games = ['pokemon'];
        break;
      case 'under':
        filters.maxPrice = 20000; // ₪200
        break;
      default:
        // 'all' - no filters
        break;
    }

    if (searchQuery.trim()) {
      filters.cardName = searchQuery;
    }

    dispatch(fetchListings(filters));
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    handleFilterChange(activeFilter);
  };

  const renderListing = ({ item }: { item: any }) => {
    const hasSharedEvent = ListingService.hasSharedEvents(item);
    const sharedEvent = ListingService.getPrimarySharedEvent(item);

    return (
      <Card style={styles.listingCard}>
        <View style={styles.listingContent}>
          <View style={styles.listingImage}>
            <Text style={styles.listingImageText}>
              {item.listing.cardName.split(' ')[0].toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.listingMeta}>
            <Text style={styles.listingName}>{item.listing.cardName}</Text>
            <Text style={styles.listingSet}>
              {item.listing.cardSet || 'Unknown Set'} · {ListingService.formatCondition(item.listing.condition)}
            </Text>
            <Text style={styles.listingPrice}>
              {ListingService.formatPrice(item.listing.priceCents)}
            </Text>
            
            <View style={styles.listingTag}>
              {hasSharedEvent ? (
                <Text style={styles.sharedEventText}>
                  📅 Both @ {sharedEvent?.name.toUpperCase()}
                </Text>
              ) : (
                <Text style={styles.noSharedEventText}>— No shared con</Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No matches.</Text>
      <Text style={styles.emptyBody}>
        Try a different filter or clear the search.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.subtitleCount}>{listings.length}</Text>
          <Text style={styles.subtitleText}> listings — sorted by shared con first</Text>
        </Text>
      </View>

      <View style={styles.searchSection}>
        <Input
          placeholder="Search a card, set, or seller…"
          value={searchQuery}
          onChangeText={handleSearch}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterSection}>
        <Button
          title="📅 Shared con"
          onPress={() => handleFilterChange('shared')}
          variant={activeFilter === 'shared' ? 'primary' : 'secondary'}
          size="small"
          style={styles.filterButton}
        />
        <Button
          title="All"
          onPress={() => handleFilterChange('all')}
          variant={activeFilter === 'all' ? 'primary' : 'secondary'}
          size="small"
          style={styles.filterButton}
        />
        <Button
          title="MTG"
          onPress={() => handleFilterChange('mtg')}
          variant={activeFilter === 'mtg' ? 'primary' : 'secondary'}
          size="small"
          style={styles.filterButton}
        />
        <Button
          title="Pokémon"
          onPress={() => handleFilterChange('pokemon')}
          variant={activeFilter === 'pokemon' ? 'primary' : 'secondary'}
          size="small"
          style={styles.filterButton}
        />
        <Button
          title="Under ₪200"
          onPress={() => handleFilterChange('under')}
          variant={activeFilter === 'under' ? 'primary' : 'secondary'}
          size="small"
          style={styles.filterButton}
        />
      </View>

      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.listing.id}
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
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h1.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleCount: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  subtitleText: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.body.fontSize,
    fontStyle: 'italic',
    color: colors.ink2,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.paper2,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterButton: {
    minWidth: 100,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  listingCard: {
    padding: spacing.lg,
  },
  listingContent: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  listingImage: {
    width: 80,
    height: 112,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImageText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: 'white',
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  listingMeta: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listingName: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  listingSet: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
    marginBottom: spacing.xs,
  },
  listingPrice: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.h3.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  listingTag: {
    marginTop: spacing.xs,
  },
  sharedEventText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  noSharedEventText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
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
  },
  emptyBody: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
    textAlign: 'center',
  },
});
```

## 5.6 Listing Store (Redux)

### Listing Store Slice
```typescript
// frontend/src/store/slices/listingSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ListingService, ListingFilters, ListingSearchResult } from '@services/listings/ListingService';

interface ListingState {
  listings: ListingSearchResult[];
  selectedListing: ListingSearchResult | null;
  loading: boolean;
  error: string | null;
  searchResults: ListingSearchResult[];
  searchLoading: boolean;
  myListing: ListingSearchResult[];
  myListingLoading: boolean;
}

const initialState: ListingState = {
  listings: [],
  selectedListing: null,
  loading: false,
  error: null,
  searchResults: [],
  searchLoading: false,
  myListing: [],
  myListingLoading: false,
};

// Async thunks
export const fetchListings = createAsyncThunk(
  'listings/fetchListings',
  async (filters: ListingFilters = {}) => {
    return await ListingService.getListings(filters);
  }
);

export const fetchListing = createAsyncThunk(
  'listings/fetchListing',
  async (listingId: string) => {
    return await ListingService.getListing(listingId);
  }
);

export const createListing = createAsyncThunk(
  'listings/createListing',
  async (data: {
    listingData: any;
    imageFile?: File;
  }) => {
    return await ListingService.createListing(data.listingData, data.imageFile);
  }
);

export const updateListing = createAsyncThunk(
  'listings/updateListing',
  async (data: { listingId: string; updateData: any }) => {
    return await ListingService.updateListing(data.listingId, data.updateData);
  }
);

export const withdrawListing = createAsyncThunk(
  'listings/withdrawListing',
  async (listingId: string) => {
    await ListingService.withdrawListing(listingId);
    return listingId;
  }
);

export const searchListings = createAsyncThunk(
  'listings/search',
  async (query: any) => {
    return await ListingService.searchListings(query);
  }
);

export const fetchMyListings = createAsyncThunk(
  'listings/fetchMyListings',
  async () => {
    return await ListingService.getSellerListings();
  }
);

const listingSlice = createSlice({
  name: 'listings',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedListing: (state, action: PayloadAction<ListingSearchResult | null>) => {
      state.selectedListing = action.payload;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch listings
      .addCase(fetchListings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchListings.fulfilled, (state, action) => {
        state.loading = false;
        state.listings = action.payload;
      })
      .addCase(fetchListings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch listings';
      })
      // Fetch listing
      .addCase(fetchListing.fulfilled, (state, action) => {
        state.selectedListing = action.payload;
      })
      // Create listing
      .addCase(createListing.fulfilled, (state, action) => {
        state.listings.unshift(action.payload);
      })
      // Update listing
      .addCase(updateListing.fulfilled, (state, action) => {
        const index = state.listings.findIndex(l => l.listing.id === action.payload.listing.id);
        if (index !== -1) {
          state.listings[index] = action.payload;
        }
        if (state.selectedListing?.listing.id === action.payload.listing.id) {
          state.selectedListing = action.payload;
        }
      })
      // Withdraw listing
      .addCase(withdrawListing.fulfilled, (state, action) => {
        state.listings = state.listings.filter(l => l.listing.id !== action.payload);
        if (state.selectedListing?.listing.id === action.payload) {
          state.selectedListing = null;
        }
      })
      // Search listings
      .addCase(searchListings.pending, (state) => {
        state.searchLoading = true;
      })
      .addCase(searchListings.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload.results;
      })
      .addCase(searchListings.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.error.message || 'Search failed';
      })
      // Fetch my listings
      .addCase(fetchMyListings.pending, (state) => {
        state.myListingLoading = true;
      })
      .addCase(fetchMyListings.fulfilled, (state, action) => {
        state.myListingLoading = false;
        state.myListing = action.payload;
      })
      .addCase(fetchMyListings.rejected, (state, action) => {
        state.myListingLoading = false;
        state.error = action.error.message || 'Failed to fetch your listings';
      });
  },
});

export const { clearError, setSelectedListing, clearSearchResults } = listingSlice.actions;
export default listingSlice.reducer;
```

## 5.7 Testing Listing System

### Listing Service Tests
```typescript
// backend/tests/services/ListingService.test.ts
import { ListingService } from '../../src/services/ListingService';
import { Database } from '../../src/config/database';

describe('ListingService', () => {
  let testUser: any;
  let testSeller: any;
  let testListing: any;

  beforeAll(async () => {
    await Database.migrate();
    
    // Create test users
    testUser = await UserModel.create({
      email: 'buyer@example.com',
      password: 'password123',
    });

    testSeller = await UserModel.create({
      email: 'seller@example.com',
      password: 'password123',
    });

    // Create user profiles
    await UserProfileModel.createProfile({
      userId: testUser.id,
      displayName: 'Buyer User',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg'],
    });

    await UserProfileModel.createProfile({
      userId: testSeller.id,
      displayName: 'Seller User',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg'],
    });
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('createListing', () => {
    it('should create a listing successfully', async () => {
      const listingData = {
        cardName: 'Liliana of the Veil',
        cardSet: 'Innistrad',
        condition: 'nm',
        priceCents: 26000,
        game: 'mtg',
      };

      const result = await ListingService.createListing(testSeller.id, listingData);

      expect(result.listing.cardName).toBe(listingData.cardName);
      expect(result.listing.sellerId).toBe(testSeller.id);
      expect(result.listing.status).toBe('active');
      expect(result.seller.displayName).toBe('Seller User');
      
      testListing = result;
    });

    it('should reject invalid price', async () => {
      const listingData = {
        cardName: 'Test Card',
        condition: 'nm',
        priceCents: -1000,
        game: 'mtg',
      };

      await expect(ListingService.createListing(testSeller.id, listingData))
        .rejects.toThrow('Price must be greater than 0');
    });

    it('should reject empty card name', async () => {
      const listingData = {
        cardName: '',
        condition: 'nm',
        priceCents: 10000,
        game: 'mtg',
      };

      await expect(ListingService.createListing(testSeller.id, listingData))
        .rejects.toThrow('Card name is required');
    });
  });

  describe('findListingsForUser', () => {
    it('should find listings for user', async () => {
      const listings = await ListingService.findListingsForUser(testUser.id);
      
      expect(listings.length).toBeGreaterThan(0);
      expect(listings[0].listing.cardName).toBe(testListing.listing.cardName);
      expect(listings[0].seller.displayName).toBe('Seller User');
    });

    it('should filter by shared events', async () => {
      const listings = await ListingService.findListingsForUser(testUser.id, {
        sharedEventsOnly: true,
      });
      
      // Should return listings where both users attend same events
      expect(Array.isArray(listings)).toBe(true);
    });
  });

  describe('updateListing', () => {
    it('should update listing successfully', async () => {
      const updateData = {
        priceCents: 25000,
        description: 'Updated description',
      };

      const result = await ListingService.updateListing(
        testListing.listing.id,
        testSeller.id,
        updateData
      );

      expect(result.listing.priceCents).toBe(updateData.priceCents);
      expect(result.listing.description).toBe(updateData.description);
    });

    it('should reject update from non-seller', async () => {
      const updateData = { priceCents: 20000 };

      await expect(ListingService.updateListing(
        testListing.listing.id,
        testUser.id,
        updateData
      )).rejects.toThrow('Only seller can update listing');
    });
  });
});
```

## Verification Checklist

- [ ] Listing service with comprehensive filtering
- [ ] Shared event detection and integration
- [ ] Listing controller with full CRUD operations
- [ ] Image upload handling for card photos
- [ ] Frontend listing service with API integration
- [ ] Browse screen migrated from existing JSX component
- [ ] Redux store for listing state management
- [ ] Search functionality with pagination
- [ ] Seller listing management
- [ ] Price and condition validation
- [ ] Comprehensive test coverage
- [ ] Integration with event system for shared conventions

## Next Steps

Proceed to **Instruction 6: Deals & Offer Negotiation** to implement the structured offer negotiation system, real-time updates via WebSocket, and the core deal flow that replaces chat-based negotiations.
