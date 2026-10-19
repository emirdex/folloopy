#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?Use a secure backup directory outside the repository}"
umask 077
mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/folloopy-$(date -u +%Y%m%dT%H%M%SZ).dump"
PGDATABASE="$DATABASE_URL" pg_dump --format=custom --no-owner --no-acl --file="$backup_file"
pg_restore --list "$backup_file" >/dev/null
printf 'Database backup created and archive structure verified.\n'
