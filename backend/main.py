"""
FastAPI local sidecar for Conseal desktop packaging.

Why local sidecar:
- Performance: Python's `re` engine is C-optimized and handles signature scans quickly.
- Security: document content never leaves the user's machine; no cloud calls required.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_ROOT = Path(__file__).resolve().parent
DB_PATH = APP_ROOT / "db.json"

DocumentStatus = Literal["pending", "approved"]
RedactionStatus = Literal["approved", "rejected"]
Confidence = Literal["high", "low"]


class AnonymizeRequest(BaseModel):
    """Input payload for document anonymization."""

    document: str = Field(..., description="Raw document content to scan and anonymize.")
    document_id: Optional[str] = Field(
        default=None,
        description="Optional external document id. If omitted, sidecar generates one.",
    )


class RedactionFinding(BaseModel):
    """Detected sensitive span with metadata."""

    token: str
    kind: str
    confidence: Confidence
    original: str
    start: int
    end: int
    status: RedactionStatus


class AnonymizeResponse(BaseModel):
    """Returned anonymized content and reversible token mapping."""

    document_id: str
    anonymized_document: str
    redactions: List[RedactionFinding]
    token_mapping: Dict[str, str]


class UpdateDocumentStatusRequest(BaseModel):
    """Patch payload for document status."""

    status: DocumentStatus


class UpdateRedactionStatusRequest(BaseModel):
    """Patch payload for redaction toggle status."""

    status: RedactionStatus


class SeedRedaction(BaseModel):
    """Seed payload row for a single redaction toggle."""

    id: str
    kind: str
    confidence: float
    original: str
    start: int
    end: int
    status: RedactionStatus


class SeedDocument(BaseModel):
    """Seed payload row for a document summary + review content."""

    id: str
    title: str
    character_count: int
    total_redactions: int
    confidence_score: float
    status: DocumentStatus
    content: str
    redactions: List[SeedRedaction]


class SeedDocumentsRequest(BaseModel):
    """Bulk seed payload sent by frontend during sidecar bootstrap."""

    documents: List[SeedDocument]


def _ensure_db() -> None:
    """Creates a default persistence file on first start."""
    if DB_PATH.exists():
        return
    DB_PATH.write_text(json.dumps({"documents": {}}, indent=2), encoding="utf-8")


def _read_db() -> Dict[str, Any]:
    """Reads persisted state from local JSON database."""
    _ensure_db()
    raw = DB_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    if "documents" not in data or not isinstance(data["documents"], dict):
        data = {"documents": {}}
    return data


def _write_db(data: Dict[str, Any]) -> None:
    """Writes persistence state atomically to reduce corruption risk."""
    tmp = DB_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(DB_PATH)


def _pattern_matches(text: str) -> List[Tuple[int, int, str, Confidence]]:
    """
    Finds high-confidence signatures with regex.

    These patterns are deterministic and produce few false positives:
    - SSN
    - email addresses
    - common API key formats (OpenAI/GitHub/AWS/Slack-like prefixes)
    """
    rules: List[Tuple[str, str]] = [
        (r"\b\d{3}-\d{2}-\d{4}\b", "ssn"),
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "email"),
        (r"\bsk-[A-Za-z0-9]{20,}\b", "api_key"),
        (r"\bghp_[A-Za-z0-9]{20,}\b", "api_key"),
        (r"\bAKIA[0-9A-Z]{16}\b", "api_key"),
        (r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b", "api_key"),
    ]
    matches: List[Tuple[int, int, str, Confidence]] = []
    for pattern, kind in rules:
        for hit in re.finditer(pattern, text):
            matches.append((hit.start(), hit.end(), kind, "high"))
    return matches


def _heuristic_matches(text: str) -> List[Tuple[int, int, str, Confidence]]:
    """
    Finds low-confidence secrets using keyword heuristics.

    Heuristics intentionally trade precision for recall and are labeled low confidence:
    - password=...
    - token: ...
    - api_key: ...
    """
    pattern = re.compile(
        r"(?im)\b(password|token|api[_-]?key)\b\s*[:=]\s*([^\s,;\"']{4,})"
    )
    matches: List[Tuple[int, int, str, Confidence]] = []
    for hit in pattern.finditer(text):
        # Only anonymize the secret value, not the key name.
        value_start, value_end = hit.span(2)
        matches.append((value_start, value_end, "secret_heuristic", "low"))
    return matches


def _dedupe_and_sort(
    spans: List[Tuple[int, int, str, Confidence]]
) -> List[Tuple[int, int, str, Confidence]]:
    """
    Orders matches and drops overlaps.

    Preference:
    1) earlier text position
    2) longer match
    3) high confidence over low confidence
    """
    def sort_key(item: Tuple[int, int, str, Confidence]) -> Tuple[int, int, int]:
        start, end, _, confidence = item
        conf_score = 0 if confidence == "high" else 1
        return (start, -(end - start), conf_score)

    sorted_spans = sorted(spans, key=sort_key)
    accepted: List[Tuple[int, int, str, Confidence]] = []
    cursor = -1
    for start, end, kind, confidence in sorted_spans:
        if start < cursor:
            continue
        accepted.append((start, end, kind, confidence))
        cursor = end
    return accepted


def anonymize_document(
    content: str,
) -> Tuple[str, List[RedactionFinding], Dict[str, str]]:
    """
    Scans sensitive spans and replaces each with a unique token.

    Returns:
    - anonymized document text
    - structured findings
    - token -> original mapping (for optional reveal in UI)
    """
    spans = _pattern_matches(content) + _heuristic_matches(content)
    spans = _dedupe_and_sort(spans)

    if not spans:
        return content, [], {}

    output_parts: List[str] = []
    findings: List[RedactionFinding] = []
    token_map: Dict[str, str] = {}

    cursor = 0
    for idx, (start, end, kind, confidence) in enumerate(spans, start=1):
        token = f"[PII_TOKEN_{idx:02d}]"
        original = content[start:end]

        output_parts.append(content[cursor:start])
        output_parts.append(token)
        cursor = end

        findings.append(
            RedactionFinding(
                token=token,
                kind=kind,
                confidence=confidence,
                original=original,
                start=start,
                end=end,
                status="approved",
            )
        )
        token_map[token] = original

    output_parts.append(content[cursor:])
    return "".join(output_parts), findings, token_map


def _persist_document(
    document_id: str,
    status: DocumentStatus,
    redactions: List[RedactionFinding],
    token_mapping: Dict[str, str],
) -> None:
    """Stores document status, redaction toggles, and reversible mapping."""
    db = _read_db()
    serialized_redactions = {
        r.token: {
            "kind": r.kind,
            "confidence": r.confidence,
            "original": r.original,
            "start": r.start,
            "end": r.end,
            "status": r.status,
        }
        for r in redactions
    }
    db["documents"][document_id] = {
        "status": status,
        "redactions": serialized_redactions,
        "token_mapping": token_mapping,
    }
    _write_db(db)


app = FastAPI(title="Conseal Local Sidecar", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    """Simple liveness probe for Electron startup checks."""
    return {"status": "ok"}


@app.post("/anonymize", response_model=AnonymizeResponse)
def post_anonymize(payload: AnonymizeRequest) -> AnonymizeResponse:
    """Detects sensitive spans, anonymizes content, and persists review state."""
    document_id = payload.document_id or str(uuid4())
    anonymized, findings, token_map = anonymize_document(payload.document)
    _persist_document(
        document_id=document_id,
        status="pending",
        redactions=findings,
        token_mapping=token_map,
    )
    return AnonymizeResponse(
        document_id=document_id,
        anonymized_document=anonymized,
        redactions=findings,
        token_mapping=token_map,
    )


@app.get("/documents/{document_id}")
def get_document(document_id: str) -> Dict[str, Any]:
    """Fetches persisted document state for app restarts."""
    db = _read_db()
    doc = db["documents"].get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document_id": document_id, **doc}


@app.get("/documents")
def list_documents() -> Dict[str, Any]:
    """Lists queue documents for dashboard left panel."""
    db = _read_db()
    documents = []
    for document_id, doc in db["documents"].items():
        documents.append(
            {
                "id": document_id,
                "title": doc.get("title", f"document-{document_id}"),
                "characterCount": doc.get("character_count", 0),
                "totalRedactions": doc.get("total_redactions", 0),
                "confidenceScore": doc.get("confidence_score", 0),
                "status": doc.get("status", "pending"),
            }
        )
    return {"documents": documents}


@app.post("/seed")
def seed_documents(payload: SeedDocumentsRequest) -> Dict[str, Any]:
    """
    Seeds sidecar persistence with dashboard queue data.

    This is used by the desktop frontend during first run so sidecar has
    the same working set the UX expects (queue + redaction toggles + content).
    """
    db = _read_db()

    for document in payload.documents:
        redactions = {
            redaction.id: {
                "kind": redaction.kind,
                "confidence": redaction.confidence,
                "original": redaction.original,
                "start": redaction.start,
                "end": redaction.end,
                "status": redaction.status,
            }
            for redaction in document.redactions
        }
        token_mapping = {
            redaction.id: redaction.original for redaction in document.redactions
        }
        db["documents"][document.id] = {
            "status": document.status,
            "title": document.title,
            "character_count": document.character_count,
            "total_redactions": document.total_redactions,
            "confidence_score": document.confidence_score,
            "content": document.content,
            "redactions": redactions,
            "token_mapping": token_mapping,
        }

    _write_db(db)
    return {"seeded": len(payload.documents)}


@app.patch("/documents/{document_id}/status")
def patch_document_status(document_id: str, payload: UpdateDocumentStatusRequest) -> Dict[str, Any]:
    """Updates persisted document status (`pending`/`approved`)."""
    db = _read_db()
    doc = db["documents"].get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc["status"] = payload.status
    _write_db(db)
    return {"document_id": document_id, "status": payload.status}


@app.patch("/documents/{document_id}/redactions/{token}")
def patch_redaction_status(
    document_id: str,
    token: str,
    payload: UpdateRedactionStatusRequest,
) -> Dict[str, Any]:
    """Updates persisted redaction toggle status (`approved`/`rejected`)."""
    db = _read_db()
    doc = db["documents"].get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    redaction = doc.get("redactions", {}).get(token)
    if not redaction:
        raise HTTPException(status_code=404, detail="Redaction token not found")
    redaction["status"] = payload.status
    _write_db(db)
    return {"document_id": document_id, "token": token, "status": payload.status}

