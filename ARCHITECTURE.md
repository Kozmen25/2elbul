# 2ElBul System Architecture

## Version
1.0

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  (Next.js 16 App Router, React 19, TypeScript 5.7)             │
└────────────────────────────┬──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌────────┐           ┌────────┐          ┌────────┐
    │ Search │           │ Browse │          │ Admin  │
    │ Page   │           │ Market │          │ Panel  │
    └────────┘           └────────┘          └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Search API  │   │ Import API   │   │ Admin API    │
    │ /search     │   │ /import      │   │ /api/admin   │
    └──────┬──────┘   └──────┬───────┘   └──────┬───────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐
│  BUSINESS LOGIC  │ │  DATA QUALITY  │ │  INTELLIGENCE    │
│  LAYER           │ │  LAYER         │ │  LAYER           │
└──────────────────┘ └────────────────┘ └──────────────────┘
```

---

## Core Modules

### 1. Source Engine (`lib/source-engine/`)
- Wraps external data sources
- Unified source interface
- Multi-source data ingestion
- Source health monitoring

### 2. Unified Source Engine (`lib/unified-source-engine/`)
- Consolidates multiple sources
- Data normalization
- Registry pattern for adapters
- Pipeline-based processing

```
Raw Data (EasyCep, GetMobil, etc.)
       ↓
   [Adapter]
       ↓
  [Pipeline]
       ↓
  [Registry]
       ↓
 Normalized Data
```

### 3. Category Taxonomy (`lib/taxonomy/`)
- Category hierarchy (Main → Category → SubCategory)
- Brand detection
- Category resolution
- Fallback chain: New Engine → Legacy → Default
- Adapter pattern for legacy system integration

### 4. Product Matcher (`lib/product-matcher.ts`)
- Title parsing
- Category assignment
- Brand/Model extraction
- Confidence scoring

### 5. Search Intelligence (`lib/search-intent.ts`)
- Query analysis
- Intent classification
- Category prediction
- Popular searches tracking

### 6. Duplicate Detection (`lib/duplicate-detection/`)
- Similarity analysis
- Fingerprinting
- Confidence-based matching

### 7. Confidence Engine (`lib/confidence/`)
- Data quality scoring
- Source reliability
- Resolution confidence
- Risk assessment

---

## Data Flow

### Import Flow
```
Source Website
    ↓
[Source Adapter]
    ↓
[Normalization Pipeline]
    ↓
[Category Resolution]
    ↓
[Product Matcher]
    ↓
[Duplicate Detection]
    ↓
[Confidence Scoring]
    ↓
Database
```

### Search Flow
```
User Query
    ↓
[Search Intent]
    ↓
[Category Prediction]
    ↓
[Database Query]
    ↓
[Ranking Pipeline]
    ↓
[Results + Intelligence]
    ↓
User
```

### Bot Flow
```
Cron Trigger
    ↓
[Bot Task]
    ↓
[Source Collection]
    ↓
[Processing Pipeline]
    ↓
[Data Enrichment]
    ↓
[Storage/Alert]
```

---

## Registry Pattern

All dynamic components use Registry for plugin-like architecture:

```typescript
// Register adapters
sourceRegistry.register('easycep', EasyCepAdapter);
sourceRegistry.register('getmobil', GetMobilAdapter);

// Use registered adapters
const adapter = sourceRegistry.get('easycep');
const data = await adapter.fetch();
```

Benefits:
- Easy to add new sources
- Loose coupling
- Configuration-driven
- No circular dependencies

---

## Factory Pattern

Complex object creation via factories:

```typescript
// Category Resolver Factory
const resolver = createCategoryResolver(
  legacyAdapter,
  newEngineAdapter
);
```

---

## Pipeline Pattern

Data transformation through pipeline stages:

```typescript
pipeline
  .use(normalization)
  .use(enrichment)
  .use(validation)
  .process(rawData);
```

---

## Dependency Injection

Context-based dependency injection for services:

```typescript
// Global singleton context
const context = getGlobalContext();
const resolver = context.getResolver();

// Optional parameters for injection
function process(input, options?: { resolver }) {
  const r = options?.resolver || context.getResolver();
}
```

---

## Folder Structure

```
2elbul/
├── app/
│   ├── api/
│   │   ├── search/          [Search endpoints]
│   │   ├── import/          [Import endpoints]
│   │   ├── admin/           [Admin endpoints]
│   │   └── cron/            [Scheduled tasks]
│   └── pages/               [UI routes]
├── lib/
│   ├── source-engine/       [Source adapters]
│   ├── unified-source-engine/ [Consolidation]
│   ├── taxonomy/            [Category system]
│   ├── product-matcher.ts   [Product matching]
│   ├── search-intent.ts     [Intent classification]
│   ├── duplicate-detection/ [Duplication detection]
│   ├── confidence/          [Confidence scoring]
│   ├── market-pulse.ts      [Market analytics]
│   ├── price-history.ts     [Historical data]
│   └── bots/                [Bot adapters]
├── app/
│   ├── admin/               [Admin pages]
│   └── (routes)/            [Public pages]
├── AGENTS.md                [Agent rules]
├── ARCHITECTURE.md          [This file]
├── PRODUCT.md               [Product vision]
└── ROADMAP.md               [Development roadmap]
```

---

## Dependency Rules

✓ ALLOWED:
- app/ can import from lib/
- lib/ can import from lib/
- API routes can import any lib/

✗ FORBIDDEN:
- lib/ cannot import from app/ (except types)
- Circular imports
- API routes importing other API routes
- lib/ importing from node_modules directly (except established)

---

## Database Layer

- Prisma ORM for type safety
- Schema-first development
- Migrations for every schema change
- No direct SQL queries

---

## API Conventions

All endpoints follow RESTful conventions:

```
GET    /api/search/suggestions       [List suggestions]
POST   /api/search/instant-bot       [Process search]
POST   /api/import/listings          [Import batch]
GET    /api/admin/products           [Admin list]
POST   /api/admin/product-matcher-test [Test matcher]
```

---

## Error Handling

- Graceful degradation
- Fallback chains
- Error logging
- Type-safe error responses

---

## Testing Strategy

- Unit tests for core logic
- Integration tests for data flow
- E2E tests for critical flows
- 72+ passing tests minimum

---

## Performance Considerations

- Caching at multiple levels
- Query optimization
- Pagination for large datasets
- Incremental processing
- Background jobs for heavy tasks

---

## Security

- No hardcoded secrets
- Environment variable validation
- Input sanitization
- SQL injection prevention (Prisma)
- Authentication middleware
- Rate limiting for APIs

---

## Monitoring & Observability

- Error tracking
- Performance metrics
- Source health checks
- Data quality monitoring
- Audit logs

---

## Architecture Evolution

The architecture follows this progression:

```
Sprint 0.5  → Taxonomy Engine
Sprint 0.5B → Integration into flows
Sprint 0.6  → Landing page UX
Sprint 0.7  → Normalization engine
Sprint 0.8  → Duplicate detection
Sprint 0.9  → Confidence engine
Sprint 1.0  → Market intelligence v1
Sprint 1.1+ → Advanced features
```

---

## Key Principles

1. **Composition over Inheritance**
   - Use adapters and middleware
   - Avoid deep class hierarchies

2. **Explicit over Implicit**
   - Type everything
   - Avoid magic behavior

3. **Failing Loudly**
   - Error when unexpected
   - Log issues immediately

4. **Testable Architecture**
   - Dependency injection
   - Registry pattern
   - Pure functions where possible

5. **Incremental Migration**
   - New alongside old
   - Gradual fallover
   - No big rewrites
