# YouTube Showcase

A minimal web application for showcasing YouTubers and their video links, built with Hono.js, TypeScript, and Cloudflare Workers.

## Features

- **Clean Interface**: Minimal design with dark/light mode toggle
- **YouTuber Management**: Add, edit, and display YouTuber profiles with images
- **Video Showcase**: Display videos with thumbnails and metadata
- **Admin Authentication**: Secure password-based admin access
- **Security**: CSRF protection, rate limiting, and secure headers
- **Cloud-First**: Built for Cloudflare Workers with D1, R2, and KV

## Tech Stack

- **Backend**: Hono.js (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Cache**: Cloudflare KV
- **Hosting**: Cloudflare Workers

## Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account
- Wrangler CLI

## Local Development Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd youtube-showcase
   npm install
   ```

2. **Set up local environment secrets**:

   Create a `.dev.vars` file in the root directory:

   ```bash
   # .dev.vars
   ADMIN_PASSWORD_HASH=your-test-password-hash-here
   CSRF_SECRET_KEY=your-test-csrf-secret-key-here
   ```

   **Quick setup with test values**:

   ```bash
   echo "ADMIN_PASSWORD_HASH=dGVzdGhhc2gxMjM=" >> .dev.vars
   echo "CSRF_SECRET_KEY=test-csrf-secret-key-for-local-development-only" >> .dev.vars
   ```

   **To generate a real password hash** (for production use):

   ```bash
   # Use Node.js to generate a proper hash
   node -e "
   const crypto = require('crypto');
   const password = 'your-secure-password';
   const salt = crypto.randomBytes(16);
   const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
   console.log('ADMIN_PASSWORD_HASH=' + Buffer.concat([salt, hash]).toString('base64'));
   "
   ```

3. **Set up local database**:

   ```bash
   npm run db:local
   ```

4. **Start development server**:

   ```bash
   npm run dev
   ```

   This runs `wrangler dev --local` which uses simulated local resources (no real Cloudflare setup needed).

   **Alternative**: To use real Cloudflare resources (after setting them up):

   ```bash
   npm run dev:remote
   ```

5. **Open in browser**:

   ```
   http://localhost:8787
   ```

   **Test login**: Use password `admin123` with the test hash above.

## Production Deployment

1. **Create Cloudflare resources**:

   ```bash
   # Create D1 database
   wrangler d1 create youtube-showcase-db

   # Create KV namespace
   wrangler kv:namespace create "RATE_LIMIT_KV"

   # Create R2 bucket
   wrangler r2 bucket create youtube-showcase-images
   ```

2. **Update wrangler.toml** with your resource IDs

3. **Set secrets**:

   ```bash
   # Set admin password (use a strong password)
   wrangler secret put ADMIN_PASSWORD_HASH

   # Set CSRF secret (use a random 32+ character string)
   wrangler secret put CSRF_SECRET_KEY
   ```

4. **Run database migrations**:

   ```bash
   npm run db:migrate
   ```

5. **Deploy**:
   ```bash
   npm run deploy
   ```

## Configuration

### Environment Variables

- `ENVIRONMENT`: Environment name (development/staging/production)
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)
- `RATE_LIMIT_MAX_ATTEMPTS`: Max failed login attempts (default: 3)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 900000)
- `AUTO_EXPORT_INTERVAL_DAYS`: Auto-export interval in days (default: 15)

### Secrets

For **local development**, create a `.dev.vars` file (automatically used by Wrangler):

```bash
ADMIN_PASSWORD_HASH=your-password-hash
CSRF_SECRET_KEY=your-csrf-secret
```

For **production**, use Wrangler secrets:

- `ADMIN_PASSWORD_HASH`: Bcrypt hash of the admin password
- `CSRF_SECRET_KEY`: Secret key for CSRF token generation

## API Endpoints

### Public Endpoints

- `GET /` - Main page
- `GET /youtubers` - YouTubers page
- `GET /videos` - Videos page
- `GET /api/youtubers` - List all YouTubers
- `GET /api/videos` - List all videos
- `GET /api/csrf-token` - Get CSRF token

### Admin Endpoints (require authentication + CSRF token)

- `POST /api/auth` - Login with password
- `GET /api/auth/verify` - Verify authentication token
- `POST /api/youtubers` - Create YouTuber
- `PUT /api/youtubers/{id}` - Update YouTuber
- `DELETE /api/youtubers/{id}` - Delete YouTuber
- `POST /api/videos` - Create video
- `PUT /api/videos/{id}` - Update video
- `DELETE /api/videos/{id}` - Delete video
- `POST /api/extract-og` - Extract Open Graph data
- `POST /api/upload-image` - Upload image
- `GET /api/export` - Export all data

## Security Features

- **Authentication**: JWT-based admin authentication
- **CSRF Protection**: Token-based CSRF protection for state-changing operations
- **Rate Limiting**: IP-based rate limiting for login attempts
- **Security Headers**: CSP, X-Frame-Options, and other security headers
- **Input Validation**: Server-side validation and sanitization
- **Password Security**: Strong password requirements and secure hashing

## Database Schema

### YouTubers Table

- `youtuber_id` - Primary key
- `name` - YouTuber name
- `tags` - JSON array of tags
- `image_url` - Profile image URL
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Videos Table

- `video_id` - Primary key
- `title` - Video title
- `description` - Video description (optional)
- `url` - Video URL
- `thumbnail_url` - Thumbnail image URL
- `is_custom_thumbnail` - Whether thumbnail is custom uploaded
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Development Scripts

- `npm run dev` - Start development server with local simulation (recommended)
- `npm run dev:remote` - Start development server with real Cloudflare resources
- `npm run build` - Build TypeScript
- `npm run deploy` - Deploy to Cloudflare
- `npm run db:migrate` - Apply migrations to remote DB
- `npm run db:local` - Apply migrations to local DB
- `npm run type-check` - Check TypeScript types

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
