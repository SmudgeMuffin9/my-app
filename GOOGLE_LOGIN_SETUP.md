# Google "Sign in with Google" setup — for a parent/instructor 🙏

Keaton is adding **Sign in with Google** to his app (smudgeGAMES). His own
Google account is a child/school account, so it **can't open Google Cloud
Console** — that's why we need an adult's Google account for this one step.

You'll create an **OAuth client** (a Client ID + Secret). It's **free** — no
billing or credit card needed. Takes ~5–10 minutes. Then hand Keaton the
Client ID + Secret and he finishes the rest.

## The one value you'll need
This is Keaton's Supabase "callback" address (where Google sends users back):

```
https://rpptipltsmafmcetofyd.supabase.co/auth/v1/callback
```

## Steps
1. Go to **console.cloud.google.com** and sign in with your (adult) Google account.
   - Click **Console** (not "Start free" — no billing needed).
2. Top bar → **project dropdown** → **New Project** → name it `smudgeGAMES` → **Create**, then select it.
3. Left menu → **APIs & Services** → **OAuth consent screen**
   - User type: **External** → **Create**
   - App name: `smudgeGAMES`; use your email for support + developer email.
   - **Save and Continue** through Scopes (skip) and Test Users (skip) → **Back to Dashboard**.
   - (Optional, so anyone can log in: on the consent screen, click **Publish app** →
     confirm. Basic email/profile login does **not** need Google verification.)
4. Left menu → **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `smudgeGAMES web`
   - **Authorized redirect URIs** → **+ Add URI** → paste the callback address above.
   - Click **Create**.
5. A box pops up with a **Client ID** and **Client Secret**. Copy both.

## Hand back to Keaton
- **Client ID** (safe to share, it's public-ish)
- **Client Secret** (treat like a password — share it privately, don't post it online)

Keaton pastes both into Supabase (Authentication → Sign In / Providers → Google)
and the rest is done in the app. Thank you! 🧁
