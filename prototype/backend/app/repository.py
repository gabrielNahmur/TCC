from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import RLock

from .domain import (
    AuditEvent,
    AuthorizationRecord,
    AuthorizationStatus,
    Fuel,
    ReasonCode,
)


class SqliteAuthorizationRepository:
    """Persistência explícita e mínima, sem campos de identificação veicular."""

    def __init__(self, database_path: str) -> None:
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA foreign_keys = ON")
        self._lock = RLock()
        self._migrate_legacy_columns()
        self._create_schema()

    def _migrate_legacy_columns(self) -> None:
        """Migração aditiva para bancos locais sintéticos de versões anteriores."""

        with self._lock, self._connection:
            rows = self._connection.execute(
                "PRAGMA table_info(authorizations)"
            ).fetchall()
            if not rows:
                return
            existing = {row["name"] for row in rows}
            for column, declaration in {
                "device_command_id": "TEXT",
                "client_request_id": "TEXT",
                "request_fingerprint": "TEXT",
            }.items():
                if column not in existing:
                    self._connection.execute(
                        f"ALTER TABLE authorizations ADD COLUMN {column} {declaration}"
                    )

    def _create_schema(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS authorizations (
                    authorization_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL CHECK (status IN (
                        'PENDING_DEVICE', 'AUTHORIZED', 'DENIED',
                        'REVIEW_REQUIRED', 'COMPLETED', 'EXPIRED', 'SUPERSEDED'
                    )),
                    requested_fuel TEXT NOT NULL CHECK (requested_fuel IN (
                        'GASOLINE', 'ETHANOL', 'DIESEL_S10', 'DIESEL_S500', 'GNV'
                    )),
                    attendant_id TEXT NOT NULL,
                    pump_id TEXT NOT NULL,
                    reason_code TEXT NOT NULL CHECK (reason_code IN (
                        'DEVICE_COMMAND_PENDING', 'FUEL_COMPATIBLE',
                        'FUEL_INCOMPATIBLE', 'NO_COMBUSTIBLE_FUEL',
                        'VEHICLE_NOT_FOUND', 'PROVIDER_TIMEOUT',
                        'PROVIDER_UNAVAILABLE', 'FUEL_MAPPING_UNKNOWN',
                        'FUEL_MAPPING_AMBIGUOUS', 'INVALID_PLATE',
                        'PUMP_NOT_CONFIGURED', 'PUMP_BUSY',
                        'NOZZLE_NOT_CONFIGURED', 'DISPENSER_UNAVAILABLE',
                        'OVERRIDE_AUTHORIZED', 'OVERRIDE_FAILED',
                        'AUTHORIZATION_COMPLETED', 'AUTHORIZATION_EXPIRED',
                        'AUTHORIZATION_SUPERSEDED'
                    )),
                    provider_mode TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT,
                    device_command_id TEXT,
                    client_request_id TEXT,
                    request_fingerprint TEXT,
                    override_used INTEGER NOT NULL DEFAULT 0
                        CHECK (override_used IN (0, 1)),
                    supervisor_id TEXT,
                    override_justification TEXT
                );

                CREATE TABLE IF NOT EXISTS audit_events (
                    event_id TEXT PRIMARY KEY,
                    authorization_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN (
                        'PENDING_DEVICE', 'AUTHORIZED', 'DENIED',
                        'REVIEW_REQUIRED', 'COMPLETED', 'EXPIRED', 'SUPERSEDED'
                    )),
                    reason_code TEXT NOT NULL CHECK (reason_code IN (
                        'DEVICE_COMMAND_PENDING', 'FUEL_COMPATIBLE',
                        'FUEL_INCOMPATIBLE', 'NO_COMBUSTIBLE_FUEL',
                        'VEHICLE_NOT_FOUND', 'PROVIDER_TIMEOUT',
                        'PROVIDER_UNAVAILABLE', 'FUEL_MAPPING_UNKNOWN',
                        'FUEL_MAPPING_AMBIGUOUS', 'INVALID_PLATE',
                        'PUMP_NOT_CONFIGURED', 'PUMP_BUSY',
                        'NOZZLE_NOT_CONFIGURED', 'DISPENSER_UNAVAILABLE',
                        'OVERRIDE_AUTHORIZED', 'OVERRIDE_FAILED',
                        'AUTHORIZATION_COMPLETED', 'AUTHORIZATION_EXPIRED',
                        'AUTHORIZATION_SUPERSEDED'
                    )),
                    created_at TEXT NOT NULL,
                    actor_id TEXT,
                    justification TEXT,
                    FOREIGN KEY (authorization_id)
                        REFERENCES authorizations(authorization_id)
                );

                CREATE INDEX IF NOT EXISTS idx_audit_authorization
                    ON audit_events(authorization_id, created_at);

                DROP INDEX IF EXISTS uq_authorization_active_pump;

                CREATE UNIQUE INDEX uq_authorization_active_pump
                    ON authorizations(pump_id)
                    WHERE status IN ('PENDING_DEVICE', 'AUTHORIZED');

                CREATE UNIQUE INDEX IF NOT EXISTS uq_authorization_client_request
                    ON authorizations(client_request_id)
                    WHERE client_request_id IS NOT NULL;
                """
            )

    def add(self, record: AuthorizationRecord, event: AuditEvent) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO authorizations (
                    authorization_id, status, requested_fuel, attendant_id,
                    pump_id, reason_code, provider_mode, created_at, updated_at,
                    expires_at, device_command_id, client_request_id,
                    request_fingerprint, override_used, supervisor_id,
                    override_justification
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                self._record_values(record),
            )
            self._insert_event(event)

    def get(self, authorization_id: str) -> AuthorizationRecord | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM authorizations WHERE authorization_id = ?",
                (authorization_id,),
            ).fetchone()
        return self._row_to_record(row) if row else None

    def get_by_client_request_id(
        self, client_request_id: str
    ) -> AuthorizationRecord | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM authorizations WHERE client_request_id = ?",
                (client_request_id,),
            ).fetchone()
        return self._row_to_record(row) if row else None

    def active_for_pump(self, pump_id: str) -> AuthorizationRecord | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM authorizations
                WHERE pump_id = ? AND status IN ('PENDING_DEVICE', 'AUTHORIZED')
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (pump_id,),
            ).fetchone()
        return self._row_to_record(row) if row else None

    def active_records(self) -> list[AuthorizationRecord]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM authorizations
                WHERE status IN ('PENDING_DEVICE', 'AUTHORIZED')
                ORDER BY updated_at
                """
            ).fetchall()
        return [self._row_to_record(row) for row in rows]

    def update(self, record: AuthorizationRecord, event: AuditEvent) -> None:
        with self._lock, self._connection:
            cursor = self._connection.execute(
                """
                UPDATE authorizations SET
                    status = ?, requested_fuel = ?, attendant_id = ?,
                    pump_id = ?, reason_code = ?, provider_mode = ?,
                    created_at = ?, updated_at = ?, expires_at = ?,
                    device_command_id = ?, client_request_id = ?,
                    request_fingerprint = ?, override_used = ?, supervisor_id = ?,
                    override_justification = ?
                WHERE authorization_id = ?
                """,
                (
                    record.status.value,
                    record.requested_fuel.value,
                    record.attendant_id,
                    record.pump_id,
                    record.reason_code.value,
                    record.provider_mode,
                    record.created_at.isoformat(),
                    record.updated_at.isoformat(),
                    record.expires_at.isoformat() if record.expires_at else None,
                    record.device_command_id,
                    record.client_request_id,
                    record.request_fingerprint,
                    int(record.override_used),
                    record.supervisor_id,
                    record.override_justification,
                    record.authorization_id,
                ),
            )
            if cursor.rowcount != 1:
                raise LookupError(record.authorization_id)
            self._insert_event(event)

    def events_for(self, authorization_id: str) -> list[AuditEvent]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM audit_events
                WHERE authorization_id = ?
                ORDER BY created_at, rowid
                """,
                (authorization_id,),
            ).fetchall()
        return [self._row_to_event(row) for row in rows]

    def table_columns(self, table: str) -> tuple[str, ...]:
        """Disponível para auditoria automatizada do esquema."""

        if table not in {"authorizations", "audit_events"}:
            raise ValueError("tabela não permitida")
        with self._lock:
            rows = self._connection.execute(f"PRAGMA table_info({table})").fetchall()
        return tuple(row["name"] for row in rows)

    def foreign_keys_enabled(self) -> bool:
        with self._lock:
            row = self._connection.execute("PRAGMA foreign_keys").fetchone()
        return bool(row[0])

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def _insert_event(self, event: AuditEvent) -> None:
        self._connection.execute(
            """
            INSERT INTO audit_events (
                event_id, authorization_id, event_type, status, reason_code,
                created_at, actor_id, justification
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.event_id,
                event.authorization_id,
                event.event_type,
                event.status.value,
                event.reason_code.value,
                event.created_at.isoformat(),
                event.actor_id,
                event.justification,
            ),
        )

    @staticmethod
    def _record_values(record: AuthorizationRecord) -> tuple[object, ...]:
        return (
            record.authorization_id,
            record.status.value,
            record.requested_fuel.value,
            record.attendant_id,
            record.pump_id,
            record.reason_code.value,
            record.provider_mode,
            record.created_at.isoformat(),
            record.updated_at.isoformat(),
            record.expires_at.isoformat() if record.expires_at else None,
            record.device_command_id,
            record.client_request_id,
            record.request_fingerprint,
            int(record.override_used),
            record.supervisor_id,
            record.override_justification,
        )

    @staticmethod
    def _row_to_record(row: sqlite3.Row) -> AuthorizationRecord:
        from datetime import datetime

        return AuthorizationRecord(
            authorization_id=row["authorization_id"],
            status=AuthorizationStatus(row["status"]),
            requested_fuel=Fuel(row["requested_fuel"]),
            attendant_id=row["attendant_id"],
            pump_id=row["pump_id"],
            reason_code=ReasonCode(row["reason_code"]),
            provider_mode=row["provider_mode"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            expires_at=(
                datetime.fromisoformat(row["expires_at"])
                if row["expires_at"]
                else None
            ),
            device_command_id=row["device_command_id"],
            client_request_id=row["client_request_id"],
            request_fingerprint=row["request_fingerprint"],
            override_used=bool(row["override_used"]),
            supervisor_id=row["supervisor_id"],
            override_justification=row["override_justification"],
        )

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> AuditEvent:
        from datetime import datetime

        return AuditEvent(
            event_id=row["event_id"],
            authorization_id=row["authorization_id"],
            event_type=row["event_type"],
            status=AuthorizationStatus(row["status"]),
            reason_code=ReasonCode(row["reason_code"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            actor_id=row["actor_id"],
            justification=row["justification"],
        )
