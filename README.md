# PrepOS

Frontend interview prep: questions with interview-ready answers, deep explanations, clues, quick revise and mock rounds. Content is static Markdown in `content/`; only user progress lives in Firebase.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Firebase web config (optional)
npm run dev
```

Without Firebase env vars the app still works and saves progress in the browser only.

## Firebase setup

1. Firebase console → create a project.
2. **Authentication** → Sign-in method → enable **Google**. Under Settings → Authorized domains, add your Vercel domain(s).
3. **Firestore Database** → create a database (production mode).
4. **Firestore → Rules** → paste the contents of [`firestore.rules`](./firestore.rules) and publish.
5. Project settings → Your apps → add a **Web app** → copy the config values into the six `NEXT_PUBLIC_FIREBASE_*` variables (locally in `.env.local`, on Vercel under Project → Settings → Environment Variables), then redeploy.

Progress is stored in one document per user: `users/{uid}`.

## Content

- Why the app is built this way: [`docs/DECISIONS.md`](./docs/DECISIONS.md)
- Format and quality bar: [`docs/CONTENT_GUIDE.md`](./docs/CONTENT_GUIDE.md)
- Track and chapter plan with target counts: [`docs/CONTENT_PLAN.md`](./docs/CONTENT_PLAN.md)
- Validate everything (also prints counts per chapter): `npm run validate` · one track: `npm run validate -- react`

Add a question by creating `content/<track>/<chapter>/<NN>-<slug>.md`; it appears in the app on the next build.
