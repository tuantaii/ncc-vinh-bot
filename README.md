# Mezon Bot Example

A NestJS-based application that demonstrates the integration of various services and features.

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- Redis (for caching and queue management)
- PostgreSQL (for database)

## Installation

1. Clone the repository:

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:

```env
PORT=3123
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
REDIS_URL="redis://localhost:6379"
```

4. Generate Prisma client:

```bash
npm run prisma:generate
# or
yarn prisma:generate
```

5. Run database migrations:

```bash
npm run prisma:migrate
# or
yarn prisma:migrate
```

## Running the Application

### Development Mode

```bash
npm run dev
# or
yarn dev
```

### Production Mode

```bash
npm run build
npm run start:prod
# or
yarn build
yarn start:prod
```
