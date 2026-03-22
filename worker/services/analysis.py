"""
Image analysis utilities for capacity and visual quality metrics.
"""
from __future__ import annotations

import io
from typing import Any

import numpy as np
from PIL import Image
from services.dct_embed import estimate_dct_capacity


def load_rgb(image_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(image, dtype=np.float32)


def mse(original: np.ndarray, modified: np.ndarray) -> float:
    diff = np.mean((original - modified) ** 2)
    return float(diff)


def psnr(mse_value: float) -> float:
    if mse_value == 0:
        return float("inf")
    return float(20 * np.log10(255.0 / np.sqrt(mse_value)))


def ssim(original: np.ndarray, modified: np.ndarray) -> float:
    original_gray = np.dot(original[..., :3], [0.299, 0.587, 0.114])
    modified_gray = np.dot(modified[..., :3], [0.299, 0.587, 0.114])

    mu_x = np.mean(original_gray)
    mu_y = np.mean(modified_gray)
    sigma_x = np.var(original_gray)
    sigma_y = np.var(modified_gray)
    sigma_xy = np.mean((original_gray - mu_x) * (modified_gray - mu_y))

    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2

    numerator = (2 * mu_x * mu_y + c1) * (2 * sigma_xy + c2)
    denominator = (mu_x ** 2 + mu_y ** 2 + c1) * (sigma_x + sigma_y + c2)
    if denominator == 0:
        return 1.0
    return float(numerator / denominator)


def get_visual_metrics(original_bytes: bytes, modified_bytes: bytes) -> dict[str, Any]:
    original = load_rgb(original_bytes)
    modified = load_rgb(modified_bytes)

    mse_value = mse(original, modified)
    return {
        "mse": round(mse_value, 6),
        "psnr": None if np.isinf(psnr(mse_value)) else round(psnr(mse_value), 6),
        "ssim": round(ssim(original, modified), 6),
    }


def estimate_capacity(carrier_bytes: bytes, mime_type: str) -> int:
    image = Image.open(io.BytesIO(carrier_bytes))
    width, height = image.size

    if mime_type == "image/jpeg":
        return max(1, estimate_dct_capacity(carrier_bytes))

    return max(1, ((width * height * len(image.getbands()) * 2) // 8) - 4)
