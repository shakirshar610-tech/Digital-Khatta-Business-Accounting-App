# Security Specification — KarobarKhata Pro

## 1. Data Invariants

1. **Authentication & Verification Gate**: Every read and write operation across all collections (`/users`, `/parties`, `/khata_entries`, `/inventory_items`, `/invoices`, `/expenses`, `/staff_members`, `/attendance_records`, `/payroll_records`) requires an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **Strict Tenant Isolation (Zero Blanket Reads)**: No user may read, list, update, or delete another user's business records. Every `allow get` and `allow list` rule enforces `resource.data.ownerId == request.auth.uid`.
3. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates the document ID path variable against `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Relational Integrity (Global Consistency Invariant)**:
   - A `KhataEntry` cannot be created unless the referenced `/parties/$(incoming().partyId)` document exists and belongs to `request.auth.uid`.
   - An `AttendanceRecord` or `PayrollRecord` cannot be created unless the referenced `/staff_members/$(incoming().staffId)` document exists and belongs to `request.auth.uid`.
5. **Immutable Identity & Creation Timestamps**: `ownerId` and `createdAt` can never be mutated during an `update` operation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
6. **Temporal Integrity**: On `create`, `createdAt == request.time && updatedAt == request.time`. On `update`, `updatedAt == request.time`.
7. **Terminal State Locking**:
   - Once an `Invoice` reaches `invoiceStatus == 'cancelled'`, no subsequent updates are permitted.
   - Once a `StaffMember` reaches `employmentStatus == 'terminated'`, no subsequent updates are permitted.
8. **Anti-Update-Gap & Shadow Field Prevention**: Every `create` and `update` invokes `isValid[Entity](incoming())` enforcing strict `hasAll` and `hasOnly` key allowlists, string length bounds, regex patterns, numeric boundaries, and enum membership.

---

## 2. The "Dirty Dozen" Payloads

### Payload 1: Unverified Email Spoofing Attack (`/parties/party_1`)
User is signed in as `uid: "user_1"`, `email_verified: false`.
```json
{
  "ownerId": "user_1",
  "name": "Al-Madina Traders",
  "phone": "03001234567",
  "address": "Jodia Bazar, Karachi",
  "partyType": "customer",
  "balance": 5000,
  "totalDebit": 5000,
  "totalCredit": 0,
  "notes": "Wholesale buyer",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 2: Cross-Tenant Identity Spoofing (`/parties/party_2`)
User `uid: "attacker_1"` attempts to create a party claiming `ownerId: "victim_1"`.
```json
{
  "ownerId": "victim_1",
  "name": "Spoofed Customer",
  "phone": "03000000000",
  "address": "Lahore",
  "partyType": "customer",
  "balance": 0,
  "totalDebit": 0,
  "totalCredit": 0,
  "notes": "",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 3: Shadow Field Injection (`/inventory_items/item_1`)
User injects an undeclared `isAdminApproved: true` field on create or update.
```json
{
  "ownerId": "user_1",
  "name": "Super Kernel Basmati Rice 25kg",
  "sku": "RICE-25KG",
  "category": "Grains",
  "unit": "bag",
  "purchasePrice": 6200,
  "salePrice": 6800,
  "stockQuantity": 40,
  "lowStockThreshold": 10,
  "isAdminApproved": true,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 4: Orphaned Relational Write (`/khata_entries/entry_1`)
User attempts to create a `KhataEntry` referencing a non-existent `partyId: "ghost_party_999"`.
```json
{
  "ownerId": "user_1",
  "partyId": "ghost_party_999",
  "partyName": "Ghost Party",
  "entryType": "debit",
  "amount": 1500,
  "paymentMethod": "cash",
  "referenceNo": "REF-01",
  "description": "Orphaned entry",
  "entryDate": "2026-10-11",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 5: Cross-Tenant Relational Hijack (`/khata_entries/entry_2`)
User `user_1` creates a `KhataEntry` referencing `partyId: "victim_party_1"` owned by `victim_1`.
```json
{
  "ownerId": "user_1",
  "partyId": "victim_party_1",
  "partyName": "Victim Customer",
  "entryType": "credit",
  "amount": 5000,
  "paymentMethod": "cash",
  "referenceNo": "REF-02",
  "description": "Hijack attempt",
  "entryDate": "2026-10-11",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 6: Terminal State Mutation (`/invoices/inv_cancelled`)
User attempts to update `paidAmount` on an invoice whose existing `invoiceStatus` is already `'cancelled'`.
```json
{
  "paidAmount": 99999,
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 7: Immortal Field Mutation (`/expenses/exp_1`)
User attempts to mutate `createdAt` or `ownerId` during an update.
```json
{
  "ownerId": "another_user",
  "createdAt": "2020-01-01T00:00:00Z",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 8: Forged Client Timestamp (`/expenses/exp_2`)
User supplies a past timestamp (`2022-05-01T00:00:00Z`) instead of `request.time` for `createdAt` or `updatedAt`.
```json
{
  "ownerId": "user_1",
  "title": "Electricity Bill",
  "category": "utilities",
  "amount": 14500,
  "paymentMethod": "bank",
  "referenceNo": "LESCO-10",
  "notes": "Backdated timestamp attack",
  "expenseDate": "2026-10-11",
  "createdAt": "2022-05-01T00:00:00Z",
  "updatedAt": "2022-05-01T00:00:00Z"
}
```

### Payload 9: Resource Exhaustion / Oversized String Poisoning (`/parties/party_big`)
User sends a 10,000-character string in `name` (exceeding `maxLength: 120`).
```json
{
  "ownerId": "user_1",
  "name": "A... (10,000 chars)",
  "phone": "03001234567",
  "address": "Karachi",
  "partyType": "customer",
  "balance": 0,
  "totalDebit": 0,
  "totalCredit": 0,
  "notes": "",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 10: Path ID Poisoning (`/parties/invalid$id!with#spaces`)
User targets a document ID containing illegal characters (`invalid$id!with#spaces`) violating `^[a-zA-Z0-9_\-]+$`.
```json
{
  "ownerId": "user_1",
  "name": "Valid Name",
  "phone": "03001234567",
  "address": "Karachi",
  "partyType": "customer",
  "balance": 0,
  "totalDebit": 0,
  "totalCredit": 0,
  "notes": "",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 11: Value Type & Boundary Poisoning on Update (`/expenses/exp_1`)
User updates whitelisted field `amount` with a negative number (`-5000`) or string (`"five thousand"`).
```json
{
  "amount": -5000,
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Payload 12: Unauthorized Blanket List Scraping (`/parties`)
Authenticated user `attacker_1` attempts an unfiltered `getDocs(collection(db, 'parties'))` to scrape all tenants' customer phone numbers and balances.
```json
{
  "query": "collection('parties') without where('ownerId', '==', request.auth.uid)"
}
```
