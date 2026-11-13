# Hearthlist Backend (PocketBase)

## Version
See `PB_VERSION` for the pinned version. Download it from https://github.com/pocketbase/pocketbase/releases

## Local development

```bash
# Download PocketBase binary (Linux AMD64 example)
VERSION=$(cat PB_VERSION)
curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip" -o pb.zip
unzip pb.zip -d ./pb_bin

# Start the server
./pb_bin/pocketbase serve --http=0.0.0.0:8090 --dir=./pb_data
```

The admin UI will be at http://127.0.0.1:8090/_/

On first run, create a superuser account.

## Hooks and migrations

- `pb_hooks/hearthlist.pb.js` — custom routes and conflict guards (auto-loaded)
- `pb_migrations/` — collection definitions (run via `pocketbase migrate up`)

## API rules summary

| Collection | Access |
|---|---|
| households | Only via custom routes (create/join) |
| users | Open sign-up; self-update (household not settable by client) |
| lists, items | Household members only; no hard delete |

## Collections

- `users` — auth collection with `display_name` and `household` relation
- `households` — name + 6-char invite_code
- `lists` — grocery lists per household
- `items` — grocery items with LWW per field group
