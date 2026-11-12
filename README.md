# Research Hub

Gemini + ChatGPT + Google results aur ek combined summary, ek hi website par.

## Local par chalana
1. Node.js 20.6+ install karein.
2. `cp .env.example .env` aur apni API keys bharein
   - Gemini: https://aistudio.google.com/apikey
   - OpenAI: https://platform.openai.com/api-keys
   - (Optional) Google Programmable Search: https://programmablesearchengine.google.com
3. `npm install`
4. `npm run dev` -> http://localhost:3000

## Deploy (Render.com example)
- GitHub par code push karein (`.env` push NA karein).
- Render > New Web Service > repo chunein. Build: `npm install`, Start: `npm start`.
- Environment tab mein saari keys daalein. Health check path: `/healthz`.

## Google par list karna
1. Apna domain jodein (Render > Custom Domains).
2. `YOUR-DOMAIN.com` ko `public/index.html`, `robots.txt`, `sitemap.xml` mein asli domain se badlein.
3. https://search.google.com/search-console > Add property > verification meta tag `index.html` mein paste karein > Verify.
4. Sitemaps > `sitemap.xml` submit karein. URL Inspection > "Request indexing".
