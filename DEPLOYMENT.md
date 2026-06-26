# Free Hosting Options

This app is already configured for Vercel and can also be deployed as a static site.

## Vercel

1. Push the repo to GitHub.
2. Import the repository in Vercel.
3. Set the build command to `npm run vercel-build`.
4. Set the output directory to `dist`.

The repo already includes `vercel.json`, so Vercel can use the defaults.

## Cloudflare Pages

1. Create a new Cloudflare Pages project from the GitHub repo.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.
4. Keep SPA routing enabled via `public/_redirects`.

## If Netlify Is Still Needed Later

The existing `netlify.toml` remains valid, but if the free usage limit is reached again, switch to Vercel or Cloudflare Pages to avoid the pause.