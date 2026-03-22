"""
Block-DCT steganography for JPEG carriers.

This implementation embeds bits by enforcing relationships between paired
mid-frequency coefficients inside 8x8 luminance blocks. It is intentionally
conservative and geared toward deterministic extraction for the current MVP.
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

BLOCK_SIZE = 8
COEFFICIENT_PAIRS = [
    ((1, 2), (2, 1)),
    ((2, 3), (3, 2)),
    ((1, 3), (3, 1)),
    ((2, 4), (4, 2)),
]


def _dct_matrix(size: int = BLOCK_SIZE) -> np.ndarray:
    matrix = np.zeros((size, size), dtype=np.float32)
    factor = np.pi / (2.0 * size)
    scale0 = np.sqrt(1.0 / size)
    scale = np.sqrt(2.0 / size)

    for u in range(size):
        for x in range(size):
            matrix[u, x] = (scale0 if u == 0 else scale) * np.cos((2 * x + 1) * u * factor)
    return matrix


DCT_MATRIX = _dct_matrix()


def dct2(block: np.ndarray) -> np.ndarray:
    return DCT_MATRIX @ block @ DCT_MATRIX.T


def idct2(block: np.ndarray) -> np.ndarray:
    return DCT_MATRIX.T @ block @ DCT_MATRIX


def estimate_dct_capacity(carrier_bytes: bytes) -> int:
    image = Image.open(io.BytesIO(carrier_bytes)).convert("YCbCr")
    width, height = image.size
    block_count = (width // BLOCK_SIZE) * (height // BLOCK_SIZE)
    capacity_bits = block_count * len(COEFFICIENT_PAIRS)
    return max(0, capacity_bits // 8)


def _bytes_to_bits(payload: bytes) -> str:
    return "".join(format(byte, "08b") for byte in payload)


def _bits_to_bytes(bits: list[str], payload_size: int) -> bytes:
    payload_bits = "".join(bits)[: payload_size * 8]
    return bytes(
        int(payload_bits[index:index + 8], 2)
        for index in range(0, len(payload_bits), 8)
    )


def embed_dct(
    carrier_bytes: bytes,
    payload: bytes,
    quality: int = 92,
    threshold: int = 18
) -> bytes:
    image = Image.open(io.BytesIO(carrier_bytes)).convert("YCbCr")
    carrier_array = np.array(image, dtype=np.float32)
    luminance = carrier_array[:, :, 0]
    height, width = luminance.shape

    payload_bits = _bytes_to_bits(payload)
    max_capacity = estimate_dct_capacity(carrier_bytes)
    if len(payload) > max_capacity:
        raise ValueError(
            f"Payload too large for DCT. Max capacity: {max_capacity} bytes, payload: {len(payload)} bytes"
        )

    bit_index = 0
    for row in range(0, height - (height % BLOCK_SIZE), BLOCK_SIZE):
        for col in range(0, width - (width % BLOCK_SIZE), BLOCK_SIZE):
            block = luminance[row:row + BLOCK_SIZE, col:col + BLOCK_SIZE] - 128.0
            transformed = dct2(block)

            for left, right in COEFFICIENT_PAIRS:
                if bit_index >= len(payload_bits):
                    break

                bit = payload_bits[bit_index]
                left_value = transformed[left]
                right_value = transformed[right]
                left_sign = 1.0 if left_value >= 0 else -1.0
                right_sign = 1.0 if right_value >= 0 else -1.0
                left_abs = abs(float(left_value))
                right_abs = abs(float(right_value))

                if bit == "1":
                    if left_abs <= right_abs + threshold:
                        left_abs = right_abs + threshold
                else:
                    if right_abs <= left_abs + threshold:
                        right_abs = left_abs + threshold

                transformed[left] = left_sign * left_abs
                transformed[right] = right_sign * right_abs
                bit_index += 1

            luminance[row:row + BLOCK_SIZE, col:col + BLOCK_SIZE] = np.clip(
                idct2(transformed) + 128.0,
                0,
                255,
            )

            if bit_index >= len(payload_bits):
                break

        if bit_index >= len(payload_bits):
            break

    carrier_array[:, :, 0] = luminance
    result_image = Image.fromarray(np.clip(carrier_array, 0, 255).astype(np.uint8), "YCbCr").convert("RGB")

    output = io.BytesIO()
    result_image.save(output, format="JPEG", quality=quality, subsampling=0)
    return output.getvalue()


def extract_dct(carrier_bytes: bytes, payload_size: int | None = None) -> bytes:
    if payload_size is None:
        raise ValueError("payload_size is required for DCT extraction")

    image = Image.open(io.BytesIO(carrier_bytes)).convert("YCbCr")
    luminance = np.array(image, dtype=np.float32)[:, :, 0]
    height, width = luminance.shape

    bits: list[str] = []
    required_bits = payload_size * 8
    for row in range(0, height - (height % BLOCK_SIZE), BLOCK_SIZE):
        for col in range(0, width - (width % BLOCK_SIZE), BLOCK_SIZE):
            block = luminance[row:row + BLOCK_SIZE, col:col + BLOCK_SIZE] - 128.0
            transformed = dct2(block)

            for left, right in COEFFICIENT_PAIRS:
                bits.append("1" if abs(float(transformed[left])) > abs(float(transformed[right])) else "0")
                if len(bits) >= required_bits:
                    return _bits_to_bytes(bits, payload_size)

    if len(bits) < required_bits:
        raise ValueError("Carrier does not contain enough DCT data for requested payload")

    return _bits_to_bytes(bits, payload_size)
