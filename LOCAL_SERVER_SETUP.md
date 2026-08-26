# Hospital Operations — Local Server Package

## What this package does

This project can run on a Windows PC as a **local web server**. After starting it, the manager opens the browser address shown in the command window, normally `http://localhost:3000`. The browser interface is the same manager-led Hospital Operations application; the PC must remain on while people use it.

> This package deliberately contains **no production database**, hospital records, passwords, OAuth credentials, storage credentials, or production secret keys. Do not copy production credentials into a shared download.

## Before starting

Install **Node.js 22 or later**, which includes Corepack, and install a local MySQL 8-compatible server. The first application launch uses the included lockfile to install its packages. The local database must be created before running the schema setup.

| Requirement | Why it is needed | You provide |
|---|---|---|
| Node.js 22+ | Runs the browser server and build process. | Node.js on the PC. |
| MySQL 8-compatible database | Stores managers, tasks, history, scorecards, and all operational records. | A new local database and database user. |
| OAuth configuration | Allows managers to sign in to protected workspaces. | An OAuth application with a local callback URL. |
| Optional object storage | Stores evidence images and PDFs. | Storage credentials if local evidence uploads are required. |
| Windows Task Scheduler | Runs recurring task generation and escalation checks. | A scheduled task every five minutes. |

## Initial local database setup

Create a **new empty database**. Do not point this package at the current production database unless an authorized database administrator has explicitly arranged a protected migration and backup. In a local MySQL administrator session, use values appropriate for your PC:

```sql
CREATE DATABASE hospital_operations CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hospital_ops'@'localhost' IDENTIFIED BY 'replace-with-a-strong-local-password';
GRANT ALL PRIVILEGES ON hospital_operations.* TO 'hospital_ops'@'localhost';
FLUSH PRIVILEGES;
```

## Configure the package

First, copy `.env.local.example` to `.env.local`. Then change `DATABASE_URL`, `JWT_SECRET`, and the OAuth values. Generate a long random `JWT_SECRET`; do not reuse a production value.

The manager sign-in flow needs an OAuth application that permits this local callback address:

```text
http://localhost:3000/api/oauth/callback
```

Set its application ID, OAuth server URL, portal URL, owner identity, and owner name in `.env.local`. The existing managed sign-in credentials are not included in this download and should not be copied from the production site.

## Initialize and start

Open the extracted project folder. First run `local-run\Initialize-Local-Database.bat`; it installs the current schema into the empty local database. Then run one of the following:

| File | Use case |
|---|---|
| `local-run\Start-Hospital-Operations.bat` | Day-to-day local development and configuration. |
| `local-run\Start-Hospital-Operations-Production.bat` | A stable local production-style server after configuration is complete. |

The first launch may install packages. When the command window shows the listening address, open it in a browser on the same PC. Keep the command window open while the local server is in use.

## Keep recurring tasks and escalation active

The hosted version uses managed background execution. On the PC package, create a **Windows Task Scheduler** task that runs `local-run\Run-Operational-Cycle.bat` every five minutes. Run it using the Windows account that owns the project folder, select “Run whether user is logged on or not” only if that account is protected, and set the task to start at system startup. This maintains recurring assignment generation, task deadline evaluation, grace periods, and escalation while the PC is running.

## Evidence uploads and operational limits

The present evidence workflow uses secure external object storage. Local evidence uploads require storage credentials for a service controlled by the hospital; without them, do not configure tasks to require evidence locally. The package does not include a database export, so the local installation begins empty unless a database administrator performs an authorized import.

For a PC used by several people, protect the Windows account, the `.env.local` file, the database password, and the local network. If people outside the PC need access, use a hospital-approved HTTPS reverse proxy and firewall rules rather than opening the development server directly to the internet.

## Download contents

The archive contains the source code, package lockfile, schema/migrations, local startup files, and this guide. It excludes `node_modules`, build output, local environment files, operational logs, database exports, production credentials, and hospital data.
