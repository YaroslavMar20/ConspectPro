# Security Specification for Conspectify AI

## Data Invariants
1. A note must have an owner.
2. Only the owner or a listed collaborator (by email) can read/write a note.
3. Users cannot modify the `ownerId` of a note once created.
4. `createdAt` is immutable.
5. `updatedAt` must be updated on changes.

## Dirty Dozen Payloads (Rejection Targets)
1. **The Identity Thief**: Try to create a note with someone else's UID as `ownerId`.
2. **The Unauthorized Reader**: Try to read a note where the user is neither owner nor collaborator.
3. **The Shadow Collaborator**: Try to add oneself to `collaboratorEmails` without being the owner.
4. **The Time Traveler**: Try to modify `createdAt` during an update.
5. **The Content Injector**: Try to inject a massive (1MB+) string as a note title.
6. **The Ghost Writer**: Try to update a note without being authenticated.
7. **The ID Poisoner**: Try to use a non-alphanumeric ID for a note.
8. **The Profile Spoofer**: Try to update someone else's user profile.
9. **The Email Hijacker**: Try to change the email in a user profile to one that doesn't match the auth token.
10. **The Size Exploit**: Try to set a `targetSize` that isn't a string or is way too long.
11. **The Delete Gatecrashing**: Try to delete a note where the user is just a collaborator (only owners can delete).
12. **The Bulk Scraper**: Try to list all notes without filtering by ownership or collaboration.

## Test Runner (Mock Logic)
We will verify these via `firestore.rules` logic.
