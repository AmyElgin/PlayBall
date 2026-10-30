# Playball iPhone app

One app for managers, coaches and parents. After signing in, each person sees
their own tabs:

| Who | Tabs | Main actions |
|---|---|---|
| Manager | Schedule, Coaches, Schools | Cancel lessons (one lesson, a school, an area or a day), add coaches, schools, classes and term dates |
| Coach | Lessons, Hours, Swaps | "Did this lesson happen?", give a lesson away, accept swaps, cancel own lesson |
| Parent | Home, Term dates, Messages | See the next lesson and every term date per child, sign up a child |

Built with Expo (SDK 58) and Expo Router. Screens are in `src/app`, shared
pieces in `src/components` and `src/lib`. The same code can become the
Android app later.

## Try it on your iPhone (no Mac needed)

1. Set up the backend first (see the README one folder up).
2. Copy `.env.example` to `.env` and fill in the two values from Supabase
   (Project Settings → API).
3. Install and start:
   ```bash
   npm install
   ```
   ```bash
   npx expo start
   ```
4. Install **Expo Go** from the App Store and scan the QR code with the iPhone camera.

Expo Go shows everything except push notifications. Those need a real build.

## Real builds, push notifications and the App Store

You need an Apple Developer account ($99 a year).

1. Link the project to Expo (adds the project id that push notifications need):
   ```bash
   npx eas-cli@latest init
   ```
2. Build and send to TestFlight, so Playball can try it on their phones:
   ```bash
   npx eas-cli@latest build --platform ios --profile production
   ```
   ```bash
   npx eas-cli@latest submit --platform ios
   ```
3. Put the Supabase values in EAS too, so builds can reach the backend:
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment production --visibility plaintext
   ```
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_KEY --value <key> --environment production --visibility plaintext
   ```

Change `ios.bundleIdentifier` in `app.json` (`za.co.playball.coachhub`) to
whatever Playball wants before the first build; it can't change after the
app is on the App Store.

## Checks

```bash
npm run typecheck
```
```bash
npx eslint src
```
