# pg-migrate

Stack Overflow style database migrations for PostgreSQL, distributed as a
**self-contained binary**. No Node, no npm, no shared libraries — one file that
applies a directory of `.sql` migrations and records what it applied.

This is a fork of [thomwright/postgres-migrations](https://github.com/thomwright/postgres-migrations)
(MIT), adding a schema-aware migrations table, tenant-scoped migration files,
and a CLI driven entirely by environment variables.

## Install

Download the binary for your platform from the
[latest release](https://github.com/kelp-fvtpl/pg-migrate/releases/latest):

```bash
curl -fsSL -o pg-migrate \
  https://github.com/kelp-fvtpl/pg-migrate/releases/download/v5.3.2/pg-migrate-linux-x64
chmod +x pg-migrate
sudo mv pg-migrate /usr/local/bin/
```

| Asset | Notes |
|---|---|
| `pg-migrate-linux-x64` | `static-pie`; runs anywhere, including `FROM scratch` |
| `pg-migrate-linux-arm64` | `static-pie` |
| `pg-migrate-macos-arm64` | Apple Silicon |
| `pg-migrate-macos-x64` | Intel Mac |

`SHA256SUMS` is attached to the release. Verify before use:

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

## Use

```bash
pg-migrate ./migrations
```

The directory is the only argument; it defaults to `./db_migrations`. Every
setting comes from the environment, and all of these are required — the CLI
exits 1 naming the first one missing:

| Variable | Meaning |
|---|---|
| `DB_NAME` | Database to migrate. Must already exist — see [Known issues](#known-issues). |
| `DB_USERNAME` | Connection user. |
| `DB_PASSWORD` | Password, or an RSA-encrypted value — see `DECRYPT_KEY_PATH`. |
| `DB_SERVER` | Host. |
| `DB_SCHEMA` | Schema holding the `migrations` bookkeeping table. |
| `DB_ENABLE_SSL` | `"true"` connects with `rejectUnauthorized: false`. |
| `DECRYPT_KEY_PATH` | RSA private key used to decrypt `DB_PASSWORD`. **Empty string means `DB_PASSWORD` is used as-is.** |
| `TENANT_CODE` | Selects tenant-scoped migration files. |
| `DB_PORT` | Optional, defaults to `5432`. |

A `.env` in the working directory is read if present. `pg-migrate <dir> test`
reads `.env.test` instead.

### Migration files

Files are `<id>_<name>.sql` or `.js` (`-` also works as the separator),
numbered consecutively from 1 with no gaps — a missing number is a hard error,
not a skipped migration.

A file named `<id>_<name>.<tenant>.sql` is applied only when `TENANT_CODE`
matches that tenant, so one directory can serve several deployments.

A `.js` migration must export `generateSql()` returning a SQL string.

Each migration runs in a transaction and is rolled back on failure, unless it
contains the line:

```sql
-- postgres-migrations disable-transaction
```

Applied migrations are hashed. Editing a file after it has been applied is an
error rather than a silent no-op. Running twice is safe — the second run
applies nothing and exits 0.

### In a container image

The binary is static, so a consuming image builds nothing:

```dockerfile
COPY pg-migrate-linux-x64 /usr/local/bin/pg-migrate
```

`FROM scratch` works: verified applying migrations from a scratch container
with no libc and no shell.

## Known issues

**`ensureDatabaseExists` does not create the database.** The CLI passes it, but
the existence check opens its connection against the *target* database, so when
that database is absent the check itself fails:

```
ERROR: database "example" does not exist
```

It exits 1 rather than doing anything silently, but **the database must be
created before pg-migrate runs.** This is a regression against upstream, which
connects to `defaultDatabase` for the check.

**`DB_SCHEMA` is not a search path.** It decides where the `migrations` table
lives. It does not set `search_path`, so unqualified DDL in a migration lands
in `public` regardless. Schema-qualify objects in your migration files.

## Build from source

```bash
npm ci
npm run package                            # all four platforms -> build/
npm run package -- pg-migrate-linux-x64    # just one
```

All four cross-compile from a single machine, so one CI runner produces the
whole set. macOS binaries should be built on macOS: `pkg` ad-hoc signs them
with the platform toolchain, and an unsigned macOS binary is killed on launch
on Apple Silicon.

`scripts/build-binaries.js` passes `--public --public-packages "*"`. That is
required, not cosmetic — `pkg` emits host-specific V8 bytecode by default, and
a cross-compiled binary is then rejected by the target's V8 at startup:

```
Error: [pkg] V8 rejected the bytecode cache ... mismatched host/target V8
```

`--public` embeds plain JavaScript instead, which is why the source is readable
inside the binary. Do not bake a secret into a build.

### Tests

`npm test` runs unit tests, lint and integration tests. The integration suite
starts PostgreSQL in Docker and needs a running Docker daemon. Four integration
tests fail, and did so before this fork was published — the two
`bad arguments - incorrect port` cases and the two `ensureDatabaseExists = true`
cases described under [Known issues](#known-issues).

## Provenance

Version 5.3.2, forked from upstream v5.3.0. The binaries are built with
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) against Node 22 and embed
plain JavaScript rather than V8 bytecode, so the packaged source is readable
inside the artifact.

## Licence

MIT — see [LICENSE](LICENSE). The upstream copyright (c) 2016 Momentum
Financial Technology is retained as the licence requires; fork modifications
are copyright (c) 2026 Kelp and released under the same terms.
