from __future__ import annotations

import hashlib
from dataclasses import dataclass

import numpy as np


EXTRACTION_MODES = ("raw_lsb", "von_neumann", "sha256_whitened")


def von_neumann_extract(bits: np.ndarray) -> np.ndarray:
    """Bias-reduction extractor using pairs: 01 -> 0, 10 -> 1."""
    usable = bits[: len(bits) - (len(bits) % 2)]
    if usable.size == 0:
        return np.zeros(0, dtype=np.uint8)
    pairs = usable.reshape(-1, 2)
    keep = pairs[:, 0] != pairs[:, 1]
    extracted = pairs[keep][:, 1]
    return extracted.astype(np.uint8)


def bits_to_bytes(bits: np.ndarray) -> bytes:
    usable = bits[: len(bits) - (len(bits) % 8)]
    if usable.size == 0:
        return b""
    packed = np.packbits(usable)
    return packed.tobytes()


def bytes_to_bits(data: bytes) -> np.ndarray:
    if not data:
        return np.zeros(0, dtype=np.uint8)
    arr = np.frombuffer(data, dtype=np.uint8)
    return np.unpackbits(arr).astype(np.uint8)


def sha256_expand(seed: bytes, blocks: int) -> bytes:
    """Expand a seed into blocks of 32 bytes using SHA-256(counter || seed)."""
    output = bytearray()
    for i in range(blocks):
        output.extend(hashlib.sha256(i.to_bytes(4, "big") + seed).digest())
    return bytes(output)


@dataclass
class ExtractionResult:
    mode: str
    raw_bit_count: int
    extracted_bit_count: int
    output_bytes: bytes


def extract_entropy(raw_bits: np.ndarray, mode: str = "sha256_whitened", blocks: int = 1) -> ExtractionResult:
    if mode not in EXTRACTION_MODES:
        raise ValueError(f"Unknown extraction mode: {mode}")

    raw_bytes = bits_to_bytes(raw_bits)
    extracted_bits = raw_bits

    if mode == "raw_lsb":
        return ExtractionResult(
            mode=mode,
            raw_bit_count=int(raw_bits.size),
            extracted_bit_count=int(raw_bits.size),
            output_bytes=raw_bytes,
        )

    extracted_bits = von_neumann_extract(raw_bits)
    extracted_bytes = bits_to_bytes(extracted_bits)

    if mode == "von_neumann":
        return ExtractionResult(
            mode=mode,
            raw_bit_count=int(raw_bits.size),
            extracted_bit_count=int(extracted_bits.size),
            output_bytes=extracted_bytes,
        )

    whitened = sha256_expand(extracted_bytes, blocks=max(1, blocks)) if extracted_bytes else b""
    return ExtractionResult(
        mode=mode,
        raw_bit_count=int(raw_bits.size),
        extracted_bit_count=int(extracted_bits.size),
        output_bytes=whitened,
    )
