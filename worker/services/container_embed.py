"""
Fallback JPEG-safe payload container embedding.

This appends a payload trailer to the carrier bytes. JPEG decoders ignore
trailing bytes, which makes this a reliable MVP transport until a true
frequency-domain implementation replaces it.
"""
from __future__ import annotations

MARKER = b"SFM1"


def embed_trailer(carrier_bytes: bytes, payload: bytes) -> bytes:
    return carrier_bytes + MARKER + len(payload).to_bytes(4, "big") + payload


def extract_trailer(carrier_bytes: bytes) -> bytes:
    marker_index = carrier_bytes.rfind(MARKER)
    if marker_index == -1:
        raise ValueError("No embedded payload marker found")

    length_start = marker_index + len(MARKER)
    payload_length = int.from_bytes(carrier_bytes[length_start:length_start + 4], "big")
    payload_start = length_start + 4
    payload_end = payload_start + payload_length
    payload = carrier_bytes[payload_start:payload_end]

    if len(payload) != payload_length:
        raise ValueError("Embedded payload is truncated")

    return payload
