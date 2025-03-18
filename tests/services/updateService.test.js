const UpdateService = require('../../src/services/updateService');
const SteamService = require('../../src/services/steamService');
const Game = require('../../src/models/Game');

jest.mock('../../src/services/steamService');
jest.mock('../../src/models/Game');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('UpdateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncNewGames', () => {
    it('should sync new games correctly', async () => {
      const steamGames = [
        { appid: 1, name: 'Game 1' },
        { appid: 2, name: 'Game 2' },
        { appid: 3, name: 'Game 3' }
      ];
      const existingIds = [1];
      const gameDetails1 = { appid: 2, name: 'Game 2', price: { final: 9.99 } };
      const gameDetails2 = { appid: 3, name: 'Game 3', price: { final: 19.99 } };

      SteamService.getGamesList.mockResolvedValue(steamGames);
      SteamService.getGameDetails
        .mockResolvedValueOnce(gameDetails1)
        .mockResolvedValueOnce(gameDetails2);

      Game.distinct.mockResolvedValue(existingIds);
      Game.insertMany.mockResolvedValue([gameDetails1, gameDetails2]);

      const result = await UpdateService.syncNewGames();

      expect(SteamService.getGamesList).toHaveBeenCalled();
      expect(Game.distinct).toHaveBeenCalledWith('appid');
      expect(SteamService.getGameDetails).toHaveBeenCalledTimes(2);
      expect(Game.insertMany).toHaveBeenCalledWith([gameDetails1, gameDetails2], expect.any(Object));
      expect(result).toEqual({ processed: 2, added: 2 });
    });

    it('should handle errors during sync', async () => {
      SteamService.getGamesList.mockRejectedValue(new Error('API error'));

      await expect(UpdateService.syncNewGames()).rejects.toThrow('Failed to sync new games');
    });
  });

  describe('updateAllGames', () => {
    it('should update games correctly', async () => {
      const mockGames = [
        { appid: 1, name: 'Game 1', toObject: () => ({ appid: 1, name: 'Game 1' }) },
        { appid: 2, name: 'Game 2', toObject: () => ({ appid: 2, name: 'Game 2' }) }
      ];
      const mockCursor = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockGames)
      };
      const updatedDetails1 = {
        appid: 1,
        name: 'Game 1 Updated',
        price: { final: 9.99, initial: 19.99, discount_percent: 50 }
      };
      const updatedDetails2 = {
        appid: 2,
        name: 'Game 2 Updated',
        price: { final: 14.99, initial: 29.99, discount_percent: 50 }
      };

      Game.find.mockReturnValue(mockCursor);
      Game.countDocuments.mockResolvedValue(2);
      Game.findOneAndUpdate.mockResolvedValue(true);

      SteamService.getGameDetails
        .mockResolvedValueOnce(updatedDetails1)
        .mockResolvedValueOnce(updatedDetails2);

      const result = await UpdateService.updateAllGames();

      expect(Game.find).toHaveBeenCalled();
      expect(Game.countDocuments).toHaveBeenCalled();
      expect(SteamService.getGameDetails).toHaveBeenCalledTimes(2);
      expect(Game.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ total: 2, updated: 2 });
    });

    it('should handle errors during update', async () => {
      Game.countDocuments.mockRejectedValue(new Error('Database error'));

      await expect(UpdateService.updateAllGames()).rejects.toThrow('Failed to update all games');
    });
  });
});
