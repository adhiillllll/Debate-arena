"""psycopg2 connection helper."""

import psycopg2

from debate_ai.config import DATABASE_URL


def get_connection():
    """Return a new psycopg2 connection to the configured DATABASE_URL."""
    return psycopg2.connect(DATABASE_URL)
