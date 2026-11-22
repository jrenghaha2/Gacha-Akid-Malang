# Security Specification — GACHA AKID MALANG

## 1. Data Invariants
1. **Master Gate**: Every subcollection document (`configs`, `items`, `players`, `history`) under `/users/{userId}` can only exist and be accessed when the parent `/users/{userId}` workspace document exists (checked via `exists()` on `get`/`delete` and `existsAfter()` on `create`/`update`).
2. **Strict Ownership & Email Verification**: All workspace reads and writes require `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId` (with verified bootstrapped admin override only where explicitly permitted, never bypassing email verification).
3. **Immutability**: `ownerId` and `createdAt` can NEVER be altered after document creation. `HistoryEntry` documents are completely immutable (no `update` allowed).
4. **Temporal Integrity**: `createdAt == request.time` on every `create`, and `updatedAt == request.time` on every `create` and `update`.
5. **Global Consistency Invariant**: Creating a `HistoryEntry` requires the referenced `playerId` document to exist in `/users/{userId}/players/{playerId}` (`existsAfter`).
6. **Path ID Hardening**: Every single-document operation validates document IDs via `^[a-zA-Z0-9_\\-]+$` and `size() <= 128`.
7. **Strict Schema & No Shadow Fields**: Every `create` checks `keys().hasAll(...) && keys().hasOnly(...)`, every `update` uses action-based `affectedKeys().hasOnly(...)` wrapped by `isValid[Entity](incoming(), userId)`.
8. **Bounded Arrays & Safe Strings**: `bundles` array is capped at `<= 20` entries; every string has explicit `.size()` bounds.
9. **Secure List Queries**: `allow list` never uses `get()`/`exists()` and always enforces `resource.data.ownerId == request.auth.uid`.
10. **PII Isolation**: No email, phone, or address is stored in Firestore documents; `/users` collection denies `list`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Identity Spoofing on Workspace Create**: User A attempts to create `/users/userA` with `ownerId: "userB"`.
2. **Cross-Tenant Read**: User B attempts to `get` `/users/userA/configs/main`.
3. **Unverified Email Bypass**: User A with `email_verified: false` (even matching admin email) attempts to create `/users/userA`.
4. **Shadow Field Injection**: User A attempts to create/update `/users/userA/players/p1` with extra ghost field `isAdmin: true`.
5. **Owner ID Hijack on Update**: User A attempts to update `/users/userA/players/p1` changing `ownerId` to `"userB"`.
6. **Timestamp Forgery**: User A attempts to create `/users/userA/items/item1` with a client-supplied past timestamp instead of `request.time`.
7. **Resource Poisoning via Long Document ID**: User A attempts to create `/users/userA/items/<200-char-id>` or an ID containing illegal characters (`bad$id`).
8. **Value Poisoning on Whitelisted Update Key**: User A updates `/users/userA/items/item1` setting `stock: -50` or `stock: "infinite"`.
9. **Unbounded Array Attack**: User A updates `/users/userA/configs/main` with `bundles` containing 25 items (> 20 max).
10. **Orphaned History Entry**: User A creates `/users/userA/history/h1` referencing a non-existent `playerId: "ghostPlayer"`.
11. **History Tampering**: User A attempts to `update` an existing `/users/userA/history/h1` to fake a `LEGENDARY` pull.
12. **Blanket User Scraping / Self-Admin Escalation**: User A attempts to `list` `/users` or `create` `/admins/userA`.
