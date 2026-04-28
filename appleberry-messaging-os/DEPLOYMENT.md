# Appleberry Messaging OS

A production-ready WhatsApp business platform for campaigns, chatbots, automation, and customer support. Built with Next.js, NestJS, PostgreSQL, and Redis.

## Features

### Core Capabilities
- **Multi-Tenant Architecture** - Support multiple organizations with isolated workspaces
- **WhatsApp Integration** - Cloud API and unofficial Web session support
- **Bulk Campaigns** - Schedule and track WhatsApp campaigns at scale
- **Chatbot Flows** - Visual flow builder for automated conversations
- **Autoresponders** - Keyword-triggered automated replies
- **Live Inbox** - Real-time team inbox with bot-to-human handoff
- **Contact CRM** - Manage, segment, and track customer conversations
- **API-First** - REST API with rate limiting and OAuth support
- **Analytics** - Comprehensive reporting and performance tracking
- **Role-Based Access** - Workspace teams with granular permissions

###Infrastructure
- **Cloud-Ready** - Docker containers, self-hosted or managed deployment
- **Job Queue** - BullMQ background workers for campaigns and webhooks
- **Message Queue** - Real-time WebSocket support for live features
- **Storage** - S3-compatible storage for media and exports
- **Monitoring** - Health checks and performance metrics

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 16+ (production)
- Redis 7+ (production)

### Local Development

```bash
# Clone the repository
git clone <repository>
cd appleberry-messaging-os

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start development services
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Seed with demo data
pnpm db:seed

# Start dev servers
pnpm dev

# Open in browser
# Frontend: http://localhost:3000
# API: http://localhost:4000/docs
# MinIO: http://localhost:9001
```

**Demo Credentials:**
- Email: `owner@appleberry.local`
- Password: `ChangeMe123!`

### Production Deployment

#### Using Docker Compose

```bash
# Build and start production stack
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker ps
docker-compose -f docker-compose.prod.yml logs -f api

# Run migrations
docker-compose exec -T api pnpm prisma migrate deploy
docker-compose exec -T api pnpm db:seed
```

#### Using Kubernetes (coming soon)

See `./docs/kubernetes-deployment.md`

#### Manual VPS Deployment

```bash
# 1. Setup system
ssh your-server
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose git

# 2. Clone and configure
git clone <repo> /opt/appleberry
cd /opt/appleberry
cp .env.example .env
# Edit .env with production values

# 3. Start services
docker-compose -f docker-compose.prod.yml up -d

# 4. Setup SSL (Let's Encrypt)
sudo certbot certonly --standalone -d yourdomain.com
# Copy certs to docker/nginx/ssl/

# 5. Restart with SSL
docker-compose -f docker-compose.prod.yml restart nginx
```

## Architecture

### Directory Structure
```
appleberry-messaging-os/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/modules/     # Feature modules
│   │   ├── src/queues/      # BullMQ workers
│   │   └── prisma/          # Database schema
│   └── web/                 # Next.js frontend
│       └── src/app/         # App router pages
├── docker/                  # Container configs
│   ├── api/                 # API Dockerfile
│   ├── web/                 # Web Dockerfile
│   └── nginx/               # Reverse proxy
├── packages/                # Shared code
└── prisma/                  # Database schema
```

### Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, TanStack Query
- **Backend**: NestJS, TypeScript, Fastify (optional)
- **Database**: PostgreSQL 16, Prisma ORM
- **Queue**: Redis,BullMQ
- **Storage**: MinIO (S3-compatible)
- **Auth**: JWT, bcrypt
- **Container**: Docker, Docker Compose

## API Documentation

### Authentication

All API endpoints require a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/v1/campaigns
```

### Key Endpoints

**Accounts**
- `GET /v1/whatsapp-accounts` - List accounts
- `POST /v1/whatsapp-accounts` - Create account
- `POST /v1/whatsapp-accounts/:id/launch` - Start campaign

**Campaigns**
- `GET /v1/campaigns` - List campaigns
- `POST /v1/campaigns` - Create campaign
- `POST /v1/campaigns/:id/launch` - Launch campaign

**Contacts**
- `GET /v1/contacts` - List contacts
- `POST /v1/contacts` - Create contact
- `POST /v1/contacts/import` - Bulk import

**Messages**
- `POST /v1/messages/send` - Send message via API
- `GET /v1/analytics/overview` - Get stats

See full API docs at `http://localhost:4000/docs`

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/appleberry
DIRECT_URL=postgresql://user:pass@localhost:5432/appleberry

# Auth
JWT_ACCESS_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-secret-key-min-32-chars

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-key

# Redis
REDIS_URL=redis://localhost:6379

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=miniosecret
S3_BUCKET=appleberry
S3_REGION=us-east-1

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/v1
```

## Database Management

### Migrations

```bash
# Create migration
pnpm --filter @appleberry/api prisma migrate dev --name add_feature

# Apply migrations
pnpm --filter @appleberry/api prisma migrate deploy

# View schema
pnpm --filter @appleberry/api prisma studio
```

### Seeding

```bash
# Run seed script
pnpm db:seed

# Includes:
# - Super admin user
# - Example organizations & workspaces
# - Sample WhatsApp accounts
# - Demo contacts and campaigns
# - Chatbot flows
```

## Monitoring & Maintenance

### Health Checks

```bash
# API health
curl http://localhost:4000/health

# Check services
docker-compose ps
docker-compose logs -f api

# Redis CLI
redis-cli ping

# Postgres status
psql -U postgres -d appleberry_messaging_os -c "\dt"
```

### Backups

```bash
# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U postgres appleberry_messaging_os > backup.sql

# Backup MinIO
docker-compose exec -T minio mc mirror /data backup/

# Restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U postgres
```

## Development

### Project Scripts

```bash
# Development
pnpm dev              # Start all dev servers
pnpm dev:api          # API only
pnpm dev:web          # Web only

# Building
pnpm build            # Build all apps
pnpm build:api        # Build API
pnpm build:web        # Build web

# Testing
pnpm test             # Run all tests
pnpm test:coverage    # With coverage

# Linting
pnpm lint             # Lint all
pnpm lint:fix         # Auto-fix

# Type-checking
pnpm typecheck        # Full type check
```

### Adding Features

1. **New Backend Module**
   ```bash
   nest generate module modules/feature-name
   nest generate service modules/feature-name
   nest generate controller modules/feature-name
   ```

2. **New Frontend Page**
   ```bash
   # Create page in apps/web/src/app/[feature]/page.tsx
   # Add route to navigation in lib/navigation.ts
   # Add API functions to lib/api.ts
   ```

3. **Database Schema Update**
   ```bash
   # Edit prisma/schema.prisma
   pnpm db:migrate dev --name add_feature
   ```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

**Database connection errors:**
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Verify DATABASE_URL in .env
psql "$DATABASE_URL"
```

**Redis connection failed:**
```bash
# Check Redis is running
docker-compose logs redis

# Test connection
redis-cli ping
```

**WhatsApp session expired:**
- Reconnect the account via UI
- Check account health score
- Review session logs in database

### Logs

```bash
# View all logs
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Filter logs
docker-compose logs api | grep error
```

## Security

- All secrets stored in environment variables
- Passwords hashed with bcrypt
- JWT tokens for API authentication
- Rate limiting on authendpoints
- CORS configured for trusted origins
- SQL injection prevention via ORM
- XSS protection headers
- CSRF tokens for state-changing operations

## License

Apache 2.0

## Support

- **Issues**: [GitHub Issues]
- **Docs**: [Full documentation](./docs)
- **Community**: [Slack/Discord]

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Roadmap

- [ ] WhatsApp Cloud API improvements
- [ ] Advanced scheduling
- [ ] AI message generation
- [ ] Customer satisfaction surveys
- [ ] Integration marketplace
- [ ] White-label support
- [ ] Mobile app (iOS/Android)
