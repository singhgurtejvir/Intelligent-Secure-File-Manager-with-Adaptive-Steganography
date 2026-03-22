import io
import os
import sys
import unittest

from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.analysis import estimate_capacity, get_visual_metrics
from services.dct_embed import embed_dct, extract_dct
from services.encryption import decrypt_payload, encrypt_payload
from services.lsb_embed import embed_lsb, extract_lsb


def make_png_bytes():
    image = Image.new("RGB", (64, 64), color=(40, 80, 120))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def make_jpeg_bytes():
    image = Image.new("RGB", (96, 96), color=(120, 90, 60))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


class WorkerServicesTests(unittest.TestCase):
    def test_lsb_round_trip(self):
        carrier = make_png_bytes()
        encrypted = encrypt_payload(b"hello-world", "password123")
        wrapped = len(encrypted).to_bytes(4, "big") + encrypted
        embedded = embed_lsb(carrier, wrapped)
        header = extract_lsb(embedded, 4)
        payload_length = int.from_bytes(header, "big")
        extracted = extract_lsb(embedded, payload_length + 4)[4:]

        self.assertEqual(decrypt_payload(extracted, "password123"), b"hello-world")

    def test_dct_round_trip(self):
        carrier = make_jpeg_bytes()
        encrypted = encrypt_payload(b"jpeg-secret", "password123")
        wrapped = len(encrypted).to_bytes(4, "big") + encrypted
        embedded = embed_dct(carrier, wrapped)
        header = extract_dct(embedded, 4)
        payload_length = int.from_bytes(header, "big")
        extracted = extract_dct(embedded, payload_length + 4)[4:]

        self.assertEqual(decrypt_payload(extracted, "password123"), b"jpeg-secret")

    def test_metrics_and_capacity(self):
        png = make_png_bytes()
        embedded = embed_lsb(png, b"\x00\x00\x00\x05hello")
        metrics = get_visual_metrics(png, embedded)

        self.assertIn("mse", metrics)
        self.assertIn("ssim", metrics)
        self.assertGreater(estimate_capacity(png, "image/png"), 0)


if __name__ == "__main__":
    unittest.main()
