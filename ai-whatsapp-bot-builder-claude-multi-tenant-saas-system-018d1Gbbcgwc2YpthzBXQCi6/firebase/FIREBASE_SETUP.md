# Firebase Hybrid Backend

This project is best run as a hybrid:

- PHP + MySQL remain the system of record
- Firebase/Firestore provide realtime state, event fan-out, and optional mobile/web clients
- Cloud Functions receive app events from PHP and materialize them into Firestore

## Recommended Split

Keep in PHP/MySQL:

- tenants
- billing/subscriptions
- bot/flow authoring
- broadcast records
- relational analytics

Use Firebase for:

- realtime inbox mirrors
- live conversation timelines
- operator dashboards
- notification/event streams
- future mobile agent apps

## Environment Variables

Add these to `.env`:

```env
FIREBASE_ENABLED=false
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_EVENT_ENDPOINT=
FIREBASE_EVENT_SECRET=
FIREBASE_ENABLE_ANON_AUTH=false
```

`FIREBASE_EVENT_ENDPOINT` should point to the deployed Cloud Function:

```text
https://<region>-<project>.cloudfunctions.net/syncWhatsAppEvent
```

## Firestore Shape

Recommended collections:

- `tenants/{tenantId}`
- `tenants/{tenantId}/conversations/{conversationId}`
- `tenants/{tenantId}/conversations/{conversationId}/messages/{messageId}`
- `tenants/{tenantId}/events/{eventId}`

## Events Sent From PHP

Currently bridged:

- `conversation.created`
- `message.created`

You can extend this later for:

- `broadcast.launched`
- `broadcast.processed`
- `bot.updated`
- `channel.updated`

## Deploy

1. Install Firebase CLI
2. Run `firebase login`
3. Run `firebase use <your-project-id>`
4. From the `firebase/` directory run:

```bash
npm install --prefix functions
firebase deploy
```

## Notes

- Firestore is not replacing the SQL schema here
- Firestore should be treated as a realtime projection layer
- If Firebase is unavailable, the PHP app still works
- `FIREBASE_ENABLE_ANON_AUTH=true` can be used for prototype realtime reads from the browser, but it is not sufficient for production multi-tenant security
