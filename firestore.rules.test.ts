/**
 * Payload-First Security TDD Specification for GACHA AKID MALANG Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Workspace Create',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userB',
      displayName: 'Attacker',
      activePlayerId: '',
      sfxEnabled: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Read',
    operation: 'get',
    path: '/users/userA/configs/main',
    auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoofing Bypass',
    operation: 'create',
    path: '/users/spoofUid',
    auth: { uid: 'spoofUid', email: 'ZiednaB@gmail.com', email_verified: false },
    payload: {
      ownerId: 'spoofUid',
      displayName: 'Spoofer',
      activePlayerId: '',
      sfxEnabled: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Player',
    operation: 'create',
    path: '/users/userA/players/p1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userA',
      name: 'Doctor',
      uncPity: 0,
      rPity: 0,
      srPity: 0,
      epicPity: 0,
      legPity: 0,
      totalPulls: 0,
      totalSpending: 0,
      tierCounts: { LEGENDARY: 0, EPIC: 0, SR: 0, RARE: 0, UNCOMMON: 0, COMMON: 0 },
      lastPullAt: 0,
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner ID Hijack on Player Update',
    operation: 'update',
    path: '/users/userA/players/p1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userB',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery on Item Create',
    operation: 'create',
    path: '/users/userA/items/item1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userA',
      name: 'Stiker',
      tier: 'COMMON',
      stock: 10,
      sortOrder: 0,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Resource Poisoning via Malformed / Oversized ID',
    operation: 'create',
    path: `/users/userA/items/${'x'.repeat(150)}`,
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userA',
      name: 'Stiker',
      tier: 'COMMON',
      stock: 10,
      sortOrder: 0,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Value Poisoning on Stock Update',
    operation: 'update',
    path: '/users/userA/items/item1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      stock: -50,
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded Bundles Array Attack (> 20)',
    operation: 'update',
    path: '/users/userA/configs/main',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      bundles: Array.from({ length: 25 }, (_, i) => ({ qty: i + 2, price: (i + 2) * 1000 })),
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned History Entry Without Valid Player',
    operation: 'create',
    path: '/users/userA/history/h1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerId: 'userA',
      playerId: 'ghostPlayer',
      playerName: 'Ghost',
      itemName: 'Merch Eksklusif',
      rarity: 'LEGENDARY',
      isPity: false,
      timeMs: 1700000000000,
      createdAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'History Immutability Violation (Update History)',
    operation: 'update',
    path: '/users/userA/history/h1',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      rarity: 'LEGENDARY',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket User List Scraping & Self-Admin Escalation',
    operation: 'create',
    path: '/admins/userA',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { uid: 'userA' },
    expected: 'PERMISSION_DENIED',
  },
];
