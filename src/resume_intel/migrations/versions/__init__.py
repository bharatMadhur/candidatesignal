"""Ordered migration modules.

Each migration module must expose:
- VERSION: stable sortable migration id, for example "20260512_0002_example".
- DESCRIPTION: short human-readable text.
- upgrade(conn): function that applies the migration using the provided psycopg connection.
"""

