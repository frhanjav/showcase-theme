# Web Application Specification

## Overview
Build a minimal web application for showcasing YouTubers and their video links. The app should be cloneable as a template that others can configure with their own Cloudflare infrastructure.

## Core Features

### UI Requirements
- Clean, minimal design with no navigation bars
- Dark mode / Light mode toggle
- Two main sections accessible via buttons: `/youtubers` and `/videos`
- Mobile-responsive design

### Data Management
- **YouTubers Section**: Display cards with profile pictures and names
- **Videos Section**: Display video links with thumbnails/covers
- **Edit Functionality**: Inline editing for names, images, tags, and video details
- All content managed by a single admin using password authentication
- No user registration or multi-user system

### Content Upload System
- **YouTubers**: Upload profile image + name + optional tags
- **Videos**: 
  - Paste video URL (YouTube, Chrome, etc.)
  - Automatically extract thumbnail using Open Graph meta tags
  - Fallback: Manual image upload if no thumbnail available
  - Override: Allow manual image upload even when thumbnail exists
- **Edit Features**:
  - In-place editing of names and tags
  - Replace images with new uploads
  - Update video URLs and automatically re-fetch thumbnails
  - Edit video titles and descriptions
  - Batch operations for multiple items

### Authentication & Security
- Single password-based admin access with bcrypt hashing
- CSRF protection with token validation
- Proper CORS policies for cross-origin requests
- Rate limiting based on IP + browser fingerprint (User-Agent, Accept headers)
- Failed login penalties:
  - 3 failed attempts = 15 minute timeout
  - Progressive timeout increases for repeated failures
- No traditional login sessions - authenticate per action with secure tokens
- Request validation and sanitization
- Content Security Policy (CSP) headers

### Technical Stack
- **Backend**: Hono.js (TypeScript/JavaScript)
- **Frontend**: Modern HTML/CSS/JavaScript (or React if preferred)
- **Database**: Cloudflare D1 (SQLite)
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Hosting**: Cloudflare Workers + Pages
- **Runtime**: Cloudflare Workers Runtime

### Data Structure

#### YouTubers Table
```json
{
  "youtuber_id": 1,
  "name": "Creator Name",
  "tags": ["1M+", "gaming", "tech"],
  "image_url": "https://bucket-url/image.jpg",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

#### Videos Table
```json
{
  "video_id": 1,
  "title": "Video Title",
  "description": "Video description (optional)",
  "url": "https://youtube.com/watch?v=...",
  "thumbnail_url": "https://bucket-url/thumb.jpg",
  "is_custom_thumbnail": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

### Configuration Requirements
- Environment variables for Cloudflare credentials (D1, R2, KV)
- Configurable admin password (hashed with bcrypt, min 12 characters)
- CSRF secret key for token generation
- CORS allowed origins configuration
- Rate limiting thresholds and timeouts
- Easy setup instructions for cloning and deployment
- Database schema auto-migration on first run
- Wrangler configuration for local development

### Data Export/Backup
- Automatic JSON export every 15 days
- Store exports in Cloudflare R2
- Manual export functionality for admin
- Include all data: youtubers, videos, metadata

### Additional Features
- Open Graph meta tag extraction for video thumbnails
- Image optimization and resizing
- Error handling for failed uploads
- Admin panel for managing content
- **Edit Operations**:
  - Inline editing with click-to-edit interface
  - Image replacement with drag-and-drop or file picker
  - Auto-save or manual save options
  - Undo/redo functionality for recent changes
  - Preview mode before saving changes
- Bulk operations (delete/edit multiple items)
- **Data Validation**:
  - URL validation for video links
  - Image format and size validation
  - Tag input validation and suggestions

## Technical Requirements

### Hono.js Implementation Details
- Use Hono.js middleware for CORS, rate limiting, and authentication
- Implement custom middleware for CSRF protection
- Use Hono's built-in request validation and body parsing
- Leverage Cloudflare Workers bindings for D1, R2, and KV access
- TypeScript for type safety and better development experience

### Security Implementation
- **Password Security**: Use bcrypt with salt rounds ≥ 12
- **CSRF Protection**: Generate secure tokens, validate on state-changing operations
- **CORS Policy**: Strict origin validation, proper preflight handling
- **Rate Limiting**: Browser fingerprinting using multiple headers
- **Input Validation**: Sanitize all user inputs, validate file types
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options

### API Endpoints
- `GET /` - Main page with mode toggle
- `GET /youtubers` - YouTubers listing page  
- `GET /videos` - Videos listing page
- `POST /api/auth` - Password verification with CSRF token
- `GET /api/csrf-token` - Get CSRF token for authenticated requests
- `POST /api/youtubers` - Add new YouTuber (requires auth + CSRF)
- `PUT /api/youtubers/{id}` - Update YouTuber details (requires auth + CSRF)
- `POST /api/videos` - Add new video (requires auth + CSRF)
- `PUT /api/videos/{id}` - Update video details (requires auth + CSRF)
- `DELETE /api/youtubers/{id}` - Remove YouTuber (requires auth + CSRF)
- `DELETE /api/videos/{id}` - Remove video (requires auth + CSRF)
- `GET /api/export` - Export all data as JSON (requires auth)
- `POST /api/extract-og` - Extract Open Graph data from URL (requires auth + CSRF)
- `POST /api/upload-image` - Upload and replace images (requires auth + CSRF)

### Rate Limiting Strategy
- Track attempts by combined hash of: IP + User-Agent + Accept headers
- Store rate limit data in Cloudflare KV with TTL
- Progressive timeouts: 15min → 30min → 1hr → 24hr
- Reset counter after successful authentication
- Implement exponential backoff for repeated violations
- Whitelist mechanism for trusted IPs (optional)

### Deployment Configuration
- Single command deployment using Wrangler CLI
- Automatic environment setup with `wrangler.toml`
- Database migration scripts for D1
- KV namespace creation for rate limiting
- R2 bucket setup for image storage
- Clear documentation for customization
- Local development setup with Wrangler dev server

## Success Criteria
- Fast loading times (<1 second on Cloudflare edge)
- Edge-first architecture leveraging Cloudflare's global network
- Easy to clone and configure with minimal setup
- Secure against common web attacks (XSS, CSRF, brute force)
- Mobile-friendly responsive interface
- Reliable image handling and storage with R2
- Efficient rate limiting without false positives
- Type-safe codebase with comprehensive error handling