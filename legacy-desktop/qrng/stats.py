from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class RandomnessStats:
    total_bits: int
    ones: int
    zeros: int
    one_ratio: float
    byte_entropy: float
    chi_square_8bit: float
    monobit_zscore: float
    runs: int
    expected_runs: float
    serial_correlation: float
    monobit_pass: bool
    runs_pass: bool
    serial_pass: bool
    byte_histogram: list[int]


def shannon_entropy(byte_values: bytes) -> float:
    if not byte_values:
        return 0.0
    counts = [0] * 256
    for b in byte_values:
        counts[b] += 1
    total = len(byte_values)
    entropy = 0.0
    for count in counts:
        if count:
            p = count / total
            entropy -= p * math.log2(p)
    return entropy


def byte_histogram(byte_values: bytes) -> list[int]:
    counts = [0] * 256
    for b in byte_values:
        counts[b] += 1
    return counts


def chi_square_uniform_8bit(byte_values: bytes) -> float:
    if not byte_values:
        return 0.0
    counts = byte_histogram(byte_values)
    expected = len(byte_values) / 256.0
    return sum(((count - expected) ** 2) / expected for count in counts if expected > 0)


def bits_from_bytes(byte_values: bytes) -> list[int]:
    bits: list[int] = []
    for b in byte_values:
        bits.extend((b >> shift) & 1 for shift in range(7, -1, -1))
    return bits


def monobit_zscore(bits: list[int]) -> float:
    if not bits:
        return 0.0
    ones = sum(bits)
    n = len(bits)
    return abs(ones - n / 2) / math.sqrt(n / 4)


def count_runs(bits: list[int]) -> int:
    if not bits:
        return 0
    runs = 1
    for i in range(1, len(bits)):
        if bits[i] != bits[i - 1]:
            runs += 1
    return runs


def expected_run_count(bits: list[int]) -> float:
    if not bits:
        return 0.0
    n = len(bits)
    p = sum(bits) / n
    return 1.0 + 2.0 * (n - 1) * p * (1.0 - p)


def serial_correlation(byte_values: bytes) -> float:
    if len(byte_values) < 2:
        return 0.0
    xs = [float(b) for b in byte_values]
    mean = sum(xs) / len(xs)
    numerator = sum((xs[i] - mean) * (xs[i + 1] - mean) for i in range(len(xs) - 1))
    denominator = sum((x - mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return numerator / denominator


def compute_stats(byte_values: bytes) -> RandomnessStats:
    bits = bits_from_bytes(byte_values)
    ones = sum(bits)
    total_bits = len(bits)
    zeros = total_bits - ones
    entropy = shannon_entropy(byte_values)
    chi_sq = chi_square_uniform_8bit(byte_values)
    mono = monobit_zscore(bits)
    runs = count_runs(bits)
    expected_runs_val = expected_run_count(bits)
    serial = serial_correlation(byte_values)
    return RandomnessStats(
        total_bits=total_bits,
        ones=ones,
        zeros=zeros,
        one_ratio=(ones / total_bits) if total_bits else 0.0,
        byte_entropy=entropy,
        chi_square_8bit=chi_sq,
        monobit_zscore=mono,
        runs=runs,
        expected_runs=expected_runs_val,
        serial_correlation=serial,
        monobit_pass=mono < 2.575,
        runs_pass=abs(runs - expected_runs_val) / max(math.sqrt(max(total_bits, 1)), 1.0) < 2.5 if total_bits else False,
        serial_pass=abs(serial) < 0.1,
        byte_histogram=byte_histogram(byte_values),
    )
