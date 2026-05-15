from __future__ import annotations

import hashlib
import os
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
SUPPORTED_STORAGE_BACKENDS = {"local", "database"}


@dataclass(frozen=True)
class StoredDocument:
    backend: str
    key: str
    original_filename: str
    content_type: str | None
    size_bytes: int
    sha256: str
    local_path: Path


class DocumentStorage(ABC):
    @abstractmethod
    def save_upload(
        self,
        *,
        tenant_id: str,
        namespace: str,
        filename: str,
        file_obj: BinaryIO,
        content_type: str | None = None,
    ) -> StoredDocument:
        raise NotImplementedError

    @abstractmethod
    def open_for_processing(self, key: str) -> Path:
        raise NotImplementedError

    @abstractmethod
    def open_for_preview(self, key: str) -> Path:
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def exists(self, key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def metadata(self, key: str) -> dict:
        raise NotImplementedError


class LocalDocumentStorage(DocumentStorage):
    backend = "local"

    def __init__(self, root: Path | None = None) -> None:
        configured_root = os.getenv("RESUME_INTEL_LOCAL_STORAGE_ROOT")
        self.root = (root or Path(configured_root) if configured_root else root or DATA_DIR / "documents").resolve()

    def save_upload(
        self,
        *,
        tenant_id: str,
        namespace: str,
        filename: str,
        file_obj: BinaryIO,
        content_type: str | None = None,
    ) -> StoredDocument:
        safe_name = Path(filename or "document").name
        suffix = Path(safe_name).suffix.lower()
        staging_dir = self.root / tenant_id / namespace / "_staging"
        staging_dir.mkdir(parents=True, exist_ok=True)
        staging_path = staging_dir / safe_name
        with staging_path.open("wb") as handle:
            shutil.copyfileobj(file_obj, handle)
        digest = _sha256_file(staging_path)
        final_name = f"{digest[:16]}{suffix}"
        final_path = self.root / tenant_id / namespace / final_name
        final_path.parent.mkdir(parents=True, exist_ok=True)
        if final_path.exists():
            staging_path.unlink(missing_ok=True)
        else:
            staging_path.replace(final_path)
        key = _key_for_path(self.root, final_path)
        return StoredDocument(
            backend=self.backend,
            key=key,
            original_filename=safe_name,
            content_type=content_type,
            size_bytes=final_path.stat().st_size,
            sha256=digest,
            local_path=final_path,
        )

    def open_for_processing(self, key: str) -> Path:
        return self._resolve_key(key)

    def open_for_preview(self, key: str) -> Path:
        return self._resolve_key(key)

    def delete(self, key: str) -> None:
        self._resolve_key(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        try:
            return self._resolve_key(key).exists()
        except ValueError:
            return False

    def metadata(self, key: str) -> dict:
        path = self._resolve_key(key)
        stat = path.stat()
        return {"backend": self.backend, "key": key, "size_bytes": stat.st_size, "local_path": str(path)}

    def _resolve_key(self, key: str) -> Path:
        path = (self.root / key).resolve()
        path.relative_to(self.root)
        return path


class DatabaseDocumentStorage(DocumentStorage):
    backend = "database"

    def __init__(self, cache_root: Path | None = None) -> None:
        self.cache_root = (cache_root or DATA_DIR / "document-cache" / "database").resolve()

    def save_upload(
        self,
        *,
        tenant_id: str,
        namespace: str,
        filename: str,
        file_obj: BinaryIO,
        content_type: str | None = None,
    ) -> StoredDocument:
        from .db import db

        safe_name = Path(filename or "document").name
        suffix = Path(safe_name).suffix.lower()
        data = file_obj.read()
        digest = hashlib.sha256(data).hexdigest()
        key = f"{tenant_id}/{namespace}/{digest[:16]}{suffix}"
        with db() as conn:
            conn.execute(
                """
                insert into document_blobs (
                  storage_key, tenant_id, namespace, original_filename,
                  content_type, size_bytes, sha256, data
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (storage_key) do nothing
                """,
                (key, tenant_id, namespace, safe_name, content_type, len(data), digest, data),
            )
            conn.commit()
        path = self._materialize(key)
        return StoredDocument(
            backend=self.backend,
            key=key,
            original_filename=safe_name,
            content_type=content_type,
            size_bytes=len(data),
            sha256=digest,
            local_path=path,
        )

    def open_for_processing(self, key: str) -> Path:
        return self._materialize(key)

    def open_for_preview(self, key: str) -> Path:
        return self._materialize(key)

    def delete(self, key: str) -> None:
        from .db import db

        with db() as conn:
            conn.execute("delete from document_blobs where storage_key=%s", (key,))
            conn.commit()
        self._cache_path(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        from .db import db

        with db() as conn:
            row = conn.execute("select 1 from document_blobs where storage_key=%s", (key,)).fetchone()
        return bool(row)

    def metadata(self, key: str) -> dict:
        from .db import db

        with db() as conn:
            row = conn.execute(
                "select original_filename, content_type, size_bytes, sha256 from document_blobs where storage_key=%s",
                (key,),
            ).fetchone()
        if not row:
            raise FileNotFoundError(key)
        return {
            "backend": self.backend,
            "key": key,
            "original_filename": row["original_filename"],
            "content_type": row["content_type"],
            "size_bytes": int(row["size_bytes"] or 0),
            "sha256": row["sha256"],
            "local_path": str(self._cache_path(key)),
        }

    def _materialize(self, key: str) -> Path:
        from .db import db

        path = self._cache_path(key)
        if path.exists():
            return path
        with db() as conn:
            row = conn.execute("select data from document_blobs where storage_key=%s", (key,)).fetchone()
        if not row:
            raise FileNotFoundError(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(row["data"]))
        return path

    def _cache_path(self, key: str) -> Path:
        safe_key = Path(key).as_posix().replace("../", "").lstrip("/")
        return (self.cache_root / safe_key).resolve()


def document_storage(backend: str | None = None) -> DocumentStorage:
    backend = backend or os.getenv("RESUME_INTEL_STORAGE_BACKEND", "local")
    if backend not in SUPPORTED_STORAGE_BACKENDS:
        raise ValueError(f"unsupported document storage backend: {backend}")
    if backend == "database":
        return DatabaseDocumentStorage()
    return LocalDocumentStorage()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _key_for_path(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()
