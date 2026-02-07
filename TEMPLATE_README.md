# Personal Portfolio Template

A beautiful, interactive personal portfolio website built with Astro and Tailwind CSS.

## Features

- **Interactive Welcome Screen** - Hold-to-enter animation with sunrise effect
- **Animated Landscape Background** - Parallax mountain scene
- **Easter Egg** - A friendly dachshund named Tub chases a bone around the page
- **Spotify Overlay** - Embed your playlist for visitors
- **Draggable Quote Translation** - Interactive García Márquez quote (customizable)
- **Tautulli Integration** - Show your recent Plex watch history
- **Mealie Integration** - Display recipes from your self-hosted instance
- **Goodreads Widget** - Show what you're currently reading
- **Responsive Design** - Looks great on all devices

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/portfolio-template.git
cd portfolio-template

# Copy environment file and add your API keys
cp .env.example .env
# Edit .env with your values

# Build and run
docker-compose up -d
```

Visit `http://localhost:4321`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/portfolio-template.git
cd portfolio-template

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

Visit `http://localhost:4321`

## Customization

### Personal Information

1. **Update your name and info** in:
   - `src/pages/index.astro` - Home page hero
   - `src/pages/professional.astro` - Professional details
   - `src/pages/personal.astro` - Personal projects
   - `src/pages/socials.astro` - Social links

2. **Replace the profile image**:
   - Add your photo to `public/images/`
   - Update the path in `src/pages/index.astro`

3. **Update social links** in `src/pages/socials.astro`

### Integrations

#### Tautulli (Plex Watch History)
1. Get your API key from Tautulli Settings > Web Interface
2. Find your user ID in Tautulli
3. Update `src/pages/api/tautulli.ts` with your Tautulli URL and user ID
4. Add `TAUTULLI_API_KEY` to your `.env`

#### Mealie (Recipes)
1. Generate an API token at `/user/profile/api-tokens` in your Mealie instance
2. Update `src/pages/api/mealie.ts` with your Mealie URL
3. Add `MEALIE_API_TOKEN` to your `.env`

#### Goodreads
1. Get your Goodreads user ID from your profile URL
2. Update the widget script URL in `src/pages/socials.astro`

#### Spotify
1. Get your playlist embed URL from Spotify (Share > Embed)
2. Update the iframe src in `src/layouts/Layout.astro`

### Styling

- **Colors**: Edit `src/styles/global.css` - look for color definitions
- **Cards**: Various card styles available: `card-sage`, `card-teal`, `card-caramel`, `card-tan`
- **Page backgrounds**: Each page has a `.page-card` style you can customize

### Quote

To change the draggable translation quote in `src/pages/index.astro`:
1. Update the `data-es` and `data-en` attributes on each `<span class="quote-phrase">`
2. Update the citation

## Deployment

### Cloudflare Tunnel

1. Create a tunnel in Cloudflare Zero Trust
2. Get your tunnel token
3. Uncomment the cloudflared service in `docker-compose.yml`
4. Add `CLOUDFLARE_TUNNEL_TOKEN` to your `.env`

### Other Platforms

Build the production version:
```bash
npm run build
```

The output in `dist/` can be deployed to any Node.js hosting platform.

## Project Structure

```
├── public/
│   └── images/          # Static images
├── src/
│   ├── layouts/
│   │   └── Layout.astro # Main layout with Tub, Spotify overlay
│   ├── pages/
│   │   ├── index.astro      # Home page
│   │   ├── professional.astro
│   │   ├── personal.astro
│   │   ├── socials.astro
│   │   ├── news.astro
│   │   └── api/             # Server-side API routes
│   │       ├── tautulli.ts
│   │       └── mealie.ts
│   └── styles/
│       └── global.css   # Global styles
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Credits

Built by [Your Name](https://yourwebsite.com)

Original template by Daniel Lopez-Cope
