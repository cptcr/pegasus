import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EconomyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import type { EconomyBalance, EconomySettings, EconomyTransaction } from '../../database/schema';

jest.mock('../../repositories/economyRepository', () => ({
  economyRepository: {
    getBalance: jest.fn(),
    ensureSettings: jest.fn(),
    createBalance: jest.fn(),
    addToBalance: jest.fn(),
    createTransaction: jest.fn(),
    transferBalance: jest.fn(),
    isOnCooldown: jest.fn(),
    getCooldown: jest.fn(),
    setCooldown: jest.fn(),
    updateBalance: jest.fn(),
    updateSettings: jest.fn(),
    getTopBalances: jest.fn(),
    getShopItem: jest.fn(),
    getUserItem: jest.fn(),
    addUserItem: jest.fn(),
    updateUserItem: jest.fn(),
    updateShopItem: jest.fn(),
    hasActiveProtection: jest.fn(),
    updateGamblingStats: jest.fn(),
    getRecentGambles: jest.fn(),
  },
}));

const mockRepository = economyRepository as jest.Mocked<typeof economyRepository>;

const createBalance = (overrides: Partial<EconomyBalance> = {}): EconomyBalance =>
  ({
    userId: 'user-1',
    guildId: 'guild-1',
    balance: 1000,
    bankBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalGambled: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as EconomyBalance;

const createSettings = (overrides: Partial<EconomySettings> = {}): EconomySettings =>
  ({
    guildId: 'guild-1',
    currencySymbol: '💰',
    currencyName: 'coins',
    startingBalance: 100,
    dailyAmount: 100,
    dailyStreak: true,
    dailyStreakBonus: 10,
    workMinAmount: 50,
    workMaxAmount: 200,
    workCooldown: 3600,
    robEnabled: true,
    robMinAmount: 100,
    robSuccessRate: 50,
    robCooldown: 86400,
    robProtectionCost: 1000,
    robProtectionDuration: 86400,
    maxBet: 10000,
    minBet: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as EconomySettings;

const createTransaction = (overrides: Partial<EconomyTransaction> = {}): EconomyTransaction =>
  ({
    id: 'txn-1',
    userId: 'user-1',
    guildId: 'guild-1',
    type: 'test',
    amount: 100,
    description: 'Test transaction',
    metadata: null,
    relatedUserId: null,
    createdAt: new Date(),
    ...overrides,
  }) as EconomyTransaction;

describe('EconomyService', () => {
  let service: EconomyService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    jest.clearAllMocks();
    service = new EconomyService();
    mockRepository.ensureSettings.mockResolvedValue(createSettings());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getOrCreateBalance', () => {
    it('returns existing balance when present', async () => {
      const balance = createBalance({ balance: 500 });
      mockRepository.getBalance.mockResolvedValueOnce(balance);

      const result = await service.getOrCreateBalance('user-1', 'guild-1');

      expect(result).toBe(balance);
      expect(mockRepository.createBalance).not.toHaveBeenCalled();
    });

    it('creates a new balance when missing', async () => {
      const settings = createSettings({ startingBalance: 250 });
      const newBalance = createBalance({ balance: 250 });

      mockRepository.getBalance.mockResolvedValueOnce(null);
      mockRepository.ensureSettings.mockResolvedValueOnce(settings);
      mockRepository.createBalance.mockResolvedValueOnce(newBalance);

      const result = await service.getOrCreateBalance('user-1', 'guild-1');

      expect(result).toEqual(newBalance);
      expect(mockRepository.createBalance).toHaveBeenCalledWith({
        userId: 'user-1',
        guildId: 'guild-1',
        balance: 250,
      });
    });
  });

  describe('addMoney', () => {
    it('adds funds and records transaction', async () => {
      const balance = createBalance({ balance: 500 });
      const updatedBalance = createBalance({ balance: 700 });
      const transaction = createTransaction({ amount: 200, type: 'reward' });

      mockRepository.getBalance.mockResolvedValue(balance);
      mockRepository.addToBalance.mockResolvedValueOnce(updatedBalance);
      mockRepository.createTransaction.mockResolvedValueOnce(transaction);

      const result = await service.addMoney('user-1', 'guild-1', 200, 'reward', 'Weekly reward');

      expect(result.success).toBe(true);
      expect(result.balance).toEqual(updatedBalance);
      expect(result.transaction).toEqual(transaction);
      expect(mockRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          guildId: 'guild-1',
          type: 'reward',
          amount: 200,
          description: 'Weekly reward',
        })
      );
    });

    it('returns failure when balance update fails', async () => {
      mockRepository.getBalance.mockResolvedValue(createBalance());
      mockRepository.addToBalance.mockResolvedValueOnce(null);

      const result = await service.addMoney('user-1', 'guild-1', 50, 'reward');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update balance');
    });
  });

  describe('transferMoney', () => {
    it('prevents transfer when sender has insufficient funds', async () => {
      mockRepository.getBalance.mockResolvedValueOnce(createBalance({ balance: 100 }));

      const result = await service.transferMoney('from-user', 'to-user', 'guild-1', 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });

    it('transfers funds between users', async () => {
      const fromBalance = createBalance({ userId: 'from-user', balance: 500 });
      const toBalance = createBalance({ userId: 'to-user', balance: 300 });
      const deductedBalance = createBalance({ userId: 'from-user', balance: 300 });
      const creditedBalance = createBalance({ userId: 'to-user', balance: 500 });
      const debitTransaction = createTransaction({
        id: 'txn-1',
        userId: 'from-user',
        amount: -200,
      });
      const creditTransaction = createTransaction({ id: 'txn-2', userId: 'to-user', amount: 200 });

      mockRepository.getBalance
        .mockResolvedValueOnce(fromBalance) // initial sender balance
        .mockResolvedValueOnce(fromBalance) // addMoney -> getOrCreateBalance (sender)
        .mockResolvedValueOnce(toBalance) // addMoney -> getOrCreateBalance (receiver)
        .mockResolvedValue(toBalance); // fallback for any additional calls

      mockRepository.addToBalance
        .mockResolvedValueOnce(deductedBalance)
        .mockResolvedValueOnce(creditedBalance);

      mockRepository.createTransaction
        .mockResolvedValueOnce(debitTransaction)
        .mockResolvedValueOnce(creditTransaction);

      const result = await service.transferMoney('from-user', 'to-user', 'guild-1', 200);

      expect(result.success).toBe(true);
      expect(mockRepository.addToBalance).toHaveBeenNthCalledWith(1, 'from-user', 'guild-1', -200);
      expect(mockRepository.addToBalance).toHaveBeenNthCalledWith(2, 'to-user', 'guild-1', 200);
    });
  });

  describe('claimDaily', () => {
    it('returns cooldown message when user is on cooldown', async () => {
      const nextAvailable = new Date(Date.now() + 3_600_000);
      mockRepository.isOnCooldown.mockResolvedValueOnce(true);
      mockRepository.getCooldown.mockResolvedValueOnce({
        userId: 'user-1',
        guildId: 'guild-1',
        commandType: 'daily',
        lastUsed: new Date(),
        nextAvailable,
      } as any);

      const result = await service.claimDaily('user-1', 'guild-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('You can claim your daily reward in');
    });

    it('awards daily reward when available', async () => {
      const balance = createBalance({ balance: 1000 });
      const updatedBalance = createBalance({ balance: 1100 });
      const transaction = createTransaction({ amount: 100, type: 'daily' });

      mockRepository.isOnCooldown.mockResolvedValueOnce(false);
      mockRepository.getCooldown.mockResolvedValueOnce(null);
      mockRepository.getBalance.mockResolvedValue(balance);
      mockRepository.addToBalance.mockResolvedValueOnce(updatedBalance);
      mockRepository.createTransaction.mockResolvedValueOnce(transaction);
      mockRepository.setCooldown.mockResolvedValueOnce({} as any);

      const result = await service.claimDaily('user-1', 'guild-1');

      expect(result.success).toBe(true);
      expect(result.balance).toEqual(updatedBalance);
      expect(result.transaction?.type).toBe('daily');
      expect(mockRepository.setCooldown).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          guildId: 'guild-1',
          commandType: 'daily',
        })
      );
    });
  });

  describe('work', () => {
    it('prevents work when on cooldown', async () => {
      mockRepository.isOnCooldown.mockResolvedValueOnce(true);
      mockRepository.getCooldown.mockResolvedValueOnce({
        userId: 'user-1',
        guildId: 'guild-1',
        commandType: 'work',
        lastUsed: new Date(),
        nextAvailable: new Date(Date.now() + 10_000),
      } as any);

      const result = await service.work('user-1', 'guild-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('You can work again in');
    });

    it('awards work payout within configured range', async () => {
      const balance = createBalance({ balance: 800 });
      const updatedBalance = createBalance({ balance: 950 });
      const transaction = createTransaction({ amount: 150, type: 'work', description: 'Job desc' });

      mockRepository.isOnCooldown.mockResolvedValueOnce(false);
      mockRepository.getBalance.mockResolvedValue(balance);
      mockRepository.addToBalance.mockResolvedValueOnce(updatedBalance);
      mockRepository.createTransaction.mockResolvedValueOnce(transaction);
      mockRepository.setCooldown.mockResolvedValueOnce({} as any);

      jest.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0);

      const result = await service.work('user-1', 'guild-1');

      expect(result.success).toBe(true);
      expect(result.transaction?.type).toBe('work');
      (Math.random as jest.Mock).mockRestore();
    });
  });

  describe('rob', () => {
    it('aborts when robbing is disabled', async () => {
      mockRepository.ensureSettings.mockResolvedValueOnce(createSettings({ robEnabled: false }));

      const result = await service.rob('robber', 'victim', 'guild-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Robbing is disabled in this server');
    });

    it('respects protection items', async () => {
      mockRepository.ensureSettings.mockResolvedValueOnce(createSettings());
      mockRepository.isOnCooldown.mockResolvedValueOnce(false);
      mockRepository.hasActiveProtection.mockResolvedValueOnce(true);
      mockRepository.setCooldown.mockResolvedValueOnce({} as any);

      const result = await service.rob('robber', 'victim', 'guild-1');

      expect(result.success).toBe(false);
      expect(result.protected).toBe(true);
    });
  });
});
