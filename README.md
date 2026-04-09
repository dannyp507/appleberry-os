<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Appleberry OS

This project runs a React frontend through a local Express server.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Review `firebase-applet-config.json` and your Firestore settings if you need to point the app at a different Firebase project
3. Optional: set `DISABLE_HMR=true` in `.env.local` if you are running in an environment where hot reload causes issues
4. Run the app:
   `npm run dev`

The local server starts on `http://localhost:3000`.

## Deploy

Production commands:

1. Build the frontend:
   `npm run build`
2. Start the production server:
   `npm run start`

Notes:

- `server.ts` serves the built `dist/` frontend in production
- `GET /health` is available for hosting platform health checks
- example hosting configs are included for `Railway` and `Render`
