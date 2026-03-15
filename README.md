# Temporal Playground

A playground for exploring [Temporal](https://temporal.io/) workflows with Node.js, PostgreSQL, and Docker Compose. This project demonstrates how to build resilient, stateful applications using Temporal's workflow orchestration capabilities.

## 🎯 What's This All About?

This is a project management system built on Temporal workflows. It lets you manage projects and issues with guarantees about data consistency—even if things crash unexpectedly. All state changes go through the database synchronously, so you've always got a complete audit trail.

**Key features:**
- Project workflow management with status tracking
- Issue workflow tracking with comments
- PostgreSQL for persistent state
- Automatic retry logic via Temporal
- Full API with REST endpoints

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 24 LTS (if you fancy running things locally)
- `curl` for testing API endpoints

### Getting Up and Running (Local Development)

This setup runs PostgreSQL and Temporal in Docker while your worker and API run locally on your machine. Perfect for rapid development and debugging.

#### 1. Start Docker services

```bash
docker compose up -d
```

This starts:
- PostgreSQL 17 database (port 5432)
- Temporal Server v1.29.4 (port 7233)
- Temporal UI (port 8080)

Give it a moment to boot (usually 15-30 seconds).

#### 2. Configure Temporal (one-time setup)

```bash
chmod +x configureTemporal.sh
./configureTemporal.sh
```

This script:
- Waits for Temporal to be ready
- Creates the `issue-system` namespace
- Sets up search attributes (ProjectId, IssueStatus, IssueAuthor)

#### 3. Install dependencies

```bash
npm install
```

#### 4. Run worker and API locally

You'll need **two terminal windows** — one for the API and one for the worker.

**Terminal 1 - Start the API:**
```bash
npm run api
```

You should see:
```
API running on :3000
```

**Terminal 2 - Start the worker:**
```bash
npm run worker
```

You should see:
```
TEMPORAL_HOST: localhost
TEMPORAL_PORT: 7233
TEMPORAL_NAMESPACE: issue-system
Connecting to Temporal at: localhost:7233
Connected to Temporal successfully!
```

This starts:
- **Temporal Worker** — listening for tasks on the `issues` and `projects` queues
- **Express API Server** — on http://localhost:3000

#### 5. Test it out

```bash
# Create a project
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Awesome Project"}'

# Create an issue (use the project ID from above)
curl -X POST http://localhost:3000/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix the thing",
    "author": "you",
    "projectId": "<project-id-from-above>"
  }'
```

#### 6. Monitor in Temporal UI

Open **http://localhost:8080** in your browser to see:
- Active workflows
- Workflow history and execution details
- Search by attributes (ProjectId, IssueStatus, etc.)

#### Stopping everything

In the terminals running `npm run api` and `npm run worker`, press `Ctrl+C` to stop the worker and API server.

Then stop Docker services:
```bash
docker compose down
```

To also remove database data:
```bash
docker compose down -v
```

**Environment**: The `.env` file is already configured for local development with `localhost` defaults.

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              YOUR LOCAL MACHINE                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────┐           │
│  │  Node.js Application (Local)             │           │
│  │  npm run api & npm run worker            │           │
│  │  (port 3000)                             │           │
│  │                                          │           │
│  │  ┌────────────────────────────────────┐  │           │
│  │  │ Temporal Worker                    │  │           │
│  │  │ • Listens for issues queue         │  │           │
│  │  │ • Listens for projects queue       │  │           │
│  │  └────────────────────────────────────┘  │           │
│  │                                          │           │
│  │  ┌────────────────────────────────────┐  │           │
│  │  │ Express API Server                 │  │           │
│  │  │ • POST /projects                   │  │           │
│  │  │ • POST /issues                     │  │           │
│  │  │ • POST /issues/:id/comments        │  │           │
│  │  └────────────────────────────────────┘  │           │
│  └──────────────────────────────────────────┘           │
│           ↓                            ↓                │
└───────────┼────────────────────────────┼────────────────┘
            │                            │
            │ localhost:5432             │ localhost:7233
            ↓                            ↓
┌─────────────────────────────────────────────────────────┐
│              Docker Services                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PostgreSQL 17          Temporal Server v1.29.4        │
│  (inside container)     (inside container)             │
│                                                         │
│          ↑                                              │
│          │ db.sql                                       │
│          ↓                                              │
│  ┌────────────────┐       Temporal UI (port 8080)      │
│  │ projects       │       (http://localhost:8080)      │
│  │ issues         │                                     │
│  │ comments       │                                     │
│  └────────────────┘                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **API Request** → Temporal Client
2. **Workflow Executes** → Logic runs (with retries, timeouts, etc.)
3. **Activity Called** → Database operation happens
4. **Result Returned** → Response sent back to client

**The magic bit:** If anything crashes, Temporal replays the workflow from the event history. Your database always ends up consistent.

### Data Consistency & Storage

**PostgreSQL is the source of truth.** Temporal orchestrates workflows but does NOT store application data.

**How it works:**

- **Issues workflow**: State lives in the database (via `saveIssue()` activity). Temporal tracks workflow state transitions (OPEN → IN_PROGRESS → FINISHED) and maintains audit history. When you query an issue, you're reading from PostgreSQL, not from Temporal.

- **Projects workflow**: State lives in the database (via `saveProject()` activity). Temporal enforces status update logic and retry policies. Database commits are synchronous—no data loss.

**Why this matters:**

1. **Your database is always consistent** — if the app crashes mid-workflow, Temporal replays from history. All database writes that were committed before the crash remain intact.

2. **Temporal is the audit trail** — view complete workflow history (what happened, when, why retries occurred) in the Temporal UI without touching the database.

3. **Activities are synchronous** — workflows wait for database writes to complete. You never have orphaned workflows with no corresponding database record.

**Example:** Creating an issue
```
API /issues → startUpdateWithStart("initIssue")
  ↓
Temporal creates workflow + executes initIssue update
  ↓
Update handler stores issue in PostgreSQL via activities
  ↓
Database confirms write → Temporal records result in history
  ↓
Response sent to client with workflow ID
```

If anything fails between steps 2-4, Temporal replays from the saved event history. Step 3 (database write) may execute again, but your DB handles this gracefully.

## 📝 Database Schema

Three main tables, automatically created from `init.sql`:

### `projects`
```
id (UUID, primary key)
name (VARCHAR)
status (VARCHAR) - ACTIVE, INACTIVE, etc.
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### `issues`
```
id (UUID, primary key)
title (VARCHAR)
author (VARCHAR)
project_id (UUID, foreign key → projects)
status (VARCHAR) - OPEN, IN_PROGRESS, FINISHED, etc.
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### `comments`
```
id (UUID, primary key)
issue_id (UUID, foreign key → issues)
author (VARCHAR)
message (TEXT)
datetime (TIMESTAMP)
created_at (TIMESTAMP)
```

## 🔌 API Endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects/:id` | Get project state |
| `POST` | `/projects/:id/status` | Update project status |

#### Example: Create a project
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Build a spaceship"}'
```

Response:
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "workflowId": "project-550e8400-e29b-41d4-a716-446655440000"
}
```

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/issues` | Create a new issue |
| `GET` | `/issues/:id/status` | Get issue status |
| `POST` | `/issues/:id/status` | Update issue status |
| `POST` | `/issues/:id/comments` | Add a comment |
| `GET` | `/issues/:id/comments` | Get all comments |

#### Example: Create an issue
```bash
curl -X POST http://localhost:3000/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database is on fire",
    "author": "alice@example.com",
    "projectId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Response:
```json
{
  "workflowId": "550e8400-e29b-41d4-a716-446655440001",
  "result": { "ok": true }
}
```

## 🛠️ Configuration

Environment variables are loaded from `.env`. The file is already set up for **local development** with `localhost` defaults:

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_HOST` | `localhost` | PostgreSQL runs in Docker but is accessible on localhost:5432 |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `temporal_demo` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `TEMPORAL_HOST` | `localhost` | Temporal runs in Docker but is accessible on localhost:7233 |
| `TEMPORAL_PORT` | `7233` | Temporal gRPC port |
| `TEMPORAL_NAMESPACE` | `issue-system` | Temporal namespace |

**No setup needed** — `.env` is pre-configured for this development workflow. Just run `npm run api` (Terminal 1) and `npm run worker` (Terminal 2) and everything connects automatically.

## 🏃 Running Everything Fully Locally (No Docker)

If you want to run PostgreSQL and Temporal locally (not in Docker), you'll need to install them separately:

```bash
# Install PostgreSQL 17 and Temporal Server on your machine
# (Instructions vary by OS)

# Create the temporal_demo database and run init.sql
psql -U postgres -f init.sql

# Update .env with your local Temporal address
# (adjust TEMPORAL_HOST if needed)

# Start the worker and API (in separate terminals)
npm run api    # Terminal 1
npm run worker # Terminal 2
```

This is more complicated than the recommended Docker setup, so we suggest using Docker for services and running only the Node.js app locally.

## 📚 Project Structure

```
.
├── docker-compose.yml           # Infrastructure: postgres, temporal, ui
├── init.sql                     # Database schema
├── .env                         # Environment variables (localhost defaults)
├── .env.example                 # Template for .env
│
├── configureTemporal.sh         # Temporal namespace & search attributes setup
├── demo.sh                      # Demo workflow execution script
│
├── index.js                     # Express API server
├── worker.js                    # Temporal worker + database pool
├── activities.js                # Activity implementations (DB operations)
│
├── issueWorkflow.js             # Issue workflow definition
├── projectWorkflow.js           # Project workflow definition
│
├── package.json                 # Node.js dependencies & scripts
├── node_modules/                # Installed packages
│
└── README.md                    # This file
```

## 🔍 Monitoring and Debugging

### Check Docker service status

```bash
docker compose ps
```

Should show postgres, temporal, and temporal-ui running.

### View Docker logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f temporal
docker compose logs -f postgres
```

### View local app logs

The worker and API logs appear in the terminals where you ran `npm run worker` and `npm run api`.

### Connect to PostgreSQL

```bash
docker compose exec postgres psql -U postgres -d temporal_demo
```

Once connected, you can query:
```sql
SELECT * FROM projects;
SELECT * FROM issues;
SELECT * FROM comments WHERE issue_id = '<issue-id>';
```

### Check Temporal namespace

```bash
docker compose exec temporal temporal operator namespace list
```

### Inspect workflows in Temporal UI

Head to **http://localhost:8080** and browse:
- Active workflows
- Workflow history and execution details
- Search by attributes (ProjectId, IssueStatus, IssueAuthor)

## 🚨 Troubleshooting

### Docker Compose fails to start

**"dependency failed to start"**

Check Temporal logs:
```bash
docker compose logs temporal
```

Common issues:
- PostgreSQL not healthy yet (wait a bit, try again)
- Wrong database driver (should be `DB: postgres12`)
- Missing `POSTGRES_SEEDS` environment variable

### Can't connect to Temporal from local app

```bash
# Verify Temporal is running
docker compose ps

# Check if port 7233 is accessible
nc -zv localhost 7233

# Check Temporal logs
docker compose logs temporal
```

### Database connection errors

```bash
# Test PostgreSQL connectivity
docker compose exec postgres pg_isready -U postgres

# Check database was created
docker compose exec postgres psql -U postgres -l

# Try connecting directly
psql -h localhost -U postgres -d temporal_demo
```

### Worker won't start

Check `.env` — make sure `TEMPORAL_HOST=localhost` and `DB_HOST=localhost` are set.

```bash
# Terminal 1 - Debug API
TEMPORAL_HOST=localhost DB_HOST=localhost npm run api

# Terminal 2 - Debug Worker
TEMPORAL_HOST=localhost DB_HOST=localhost npm run worker
```

### Temporal UI shows no workflows

- Give it a moment to boot (health checks take ~30 seconds)
- Ensure `configureTemporal.sh` was run successfully
- Check the script output for any errors

### API endpoints return errors

```bash
# Check if local app is running
curl http://localhost:3000/projects

# Check app logs in terminals where you ran npm run api and npm run worker
# Look for database connection errors
```

## 🧹 Cleaning Up

Stop everything:
```bash
docker compose down
```

Stop everything and nuke the database:
```bash
docker compose down -v
```

### Clear Temporal workflows (keep database)

If you want to reset Temporal workflows but keep database data intact:

```bash
# Stop all services
docker compose down

# Remove only Temporal volumes (keeps PostgreSQL data)
docker volume rm temporal_demo_postgres
```

This is useful for testing reset scenarios without losing your application data in PostgreSQL.

## 📖 What to Explore

- **Workflow definitions**: Check `issueWorkflow.js` and `projectWorkflow.js` to see how Temporal workflows work
- **Activities**: Look at `activities.js` to understand how database operations integrate with workflows
- **Retry logic**: Temporal handles retries automatically—watch the UI to see failed activities get retried
- **Continue as New**: The workflows use `continueAsNew` to reset history and keep workflow state fresh

## 🤔 How Temporal Keeps Things Consistent

Here's the clever bit:

1. **Workflow starts** → Temporal records this in event history
2. **Activity executes** → Database write happens
3. **Result returned** → Temporal records success in history
4. **Crash happens** → No problem! Temporal replays from history
5. **Database is safe** → All committed writes are preserved

This means your database always has a complete record of what actually completed, even if your application crashes mid-way through a workflow.

## 📝 Notes

- Activities are **synchronous**—workflows wait for the database write to complete before proceeding
- The database is the source of truth—Temporal's history is for orchestration, not data storage
- Search attributes (`ProjectId`, `IssueStatus`, etc.) let you query workflows by business data in Temporal UI
- Workflows can run indefinitely and use `continueAsNew` to manage history size

## 🤝 Contributing

Feel free to fork, experiment, and break things. That's what playgrounds are for!

## 📄 Licence

MIT (or whatever you fancy)
