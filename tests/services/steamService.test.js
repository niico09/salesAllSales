const axios = require('axios');
const SteamService = require('../../src/services/steamService');

// Mock dependencies
jest.mock('axios');
jest.mock('node-cache');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('SteamService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getGamesList', () => {
    it('should return cached games list if available', async () => {
      // Mock cache hit
      const mockGames = [{ appid: 1, name: 'Test Game' }];
      SteamService.cache.get.mockReturnValue(mockGames);

      const result = await SteamService.getGamesList();

      expect(SteamService.cache.get).toHaveBeenCalledWith('steam_games_list');
      expect(result).toEqual(mockGames);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch games list from API if not cached', async () => {
      // Mock cache miss
      SteamService.cache.get.mockReturnValue(null);

      // Mock API response
      const mockResponse = {
        data: {
          applist: {
            apps: [
              { appid: 1, name: 'Test Game' },
              { appid: 2, name: 'Test Demo', type: 'demo' },
              { appid: 3, name: 'Test App' }
            ]
          }
        }
      };
      axios.get.mockResolvedValue(mockResponse);

      const result = await SteamService.getGamesList();

      expect(SteamService.cache.get).toHaveBeenCalledWith('steam_games_list');
      expect(axios.get).toHaveBeenCalled();
      expect(SteamService.cache.set).toHaveBeenCalled();
      expect(result).toHaveLength(2); // Should filter out the demo
      expect(result).toEqual([
        { appid: 1, name: 'Test Game' },
        { appid: 3, name: 'Test App' }
      ]);
    });

    it('should handle API errors', async () => {
      // Mock cache miss
      SteamService.cache.get.mockReturnValue(null);

      // Mock API error
      const error = new Error('API error');
      axios.get.mockRejectedValue(error);

      await expect(SteamService.getGamesList()).rejects.toThrow('Failed to fetch games list');
    });
  });

  describe('getGameDetails', () => {
    it('should return null if appid is not provided', async () => {
      const result = await SteamService.getGameDetails();
      expect(result).toBeNull();
    });

    it('should return cached game details if available', async () => {
      const appid = 123;
      const mockDetails = { appid, name: 'Test Game' };
      SteamService.cache.get.mockReturnValue(mockDetails);

      const result = await SteamService.getGameDetails(appid);

      expect(SteamService.cache.get).toHaveBeenCalledWith(`game_details_${appid}`);
      expect(result).toEqual(mockDetails);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch game details from API if not cached', async () => {
      const appid = 123;
      const name = 'Test Game';
      // Mock cache miss
      SteamService.cache.get.mockReturnValue(null);

      // Mock API response
      const mockResponse = {
        data: {
          [appid]: {
            success: true,
            data: {
              name: 'Test Game',
              type: 'game',
              is_free: false,
              price_overview: {
                currency: 'USD',
                initial: 1999,
                final: 999,
                discount_percent: 50,
                initial_formatted: '$19.99',
                final_formatted: '$9.99'
              }
            }
          }
        }
      };
      axios.get.mockResolvedValue(mockResponse);

      const result = await SteamService.getGameDetails(appid, name);

      expect(SteamService.cache.get).toHaveBeenCalledWith(`game_details_${appid}`);
      expect(axios.get).toHaveBeenCalled();
      expect(SteamService.cache.set).toHaveBeenCalled();
      expect(result).toHaveProperty('appid', appid);
      expect(result).toHaveProperty('name', 'Test Game');
      expect(result).toHaveProperty('price');
      expect(result.price).toHaveProperty('currency', 'USD');
      expect(result.price).toHaveProperty('final', 9.99);
    });

    it('should handle API errors', async () => {
      const appid = 123;
      // Mock cache miss
      SteamService.cache.get.mockReturnValue(null);

      // Mock API error
      const error = new Error('API error');
      axios.get.mockRejectedValue(error);

      const result = await SteamService.getGameDetails(appid);
      expect(result).toBeNull();
    });
  });
});
