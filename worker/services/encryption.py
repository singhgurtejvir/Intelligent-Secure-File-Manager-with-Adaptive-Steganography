"""
AES-256-GCM encryption/decryption utilities
"""
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

def derive_key(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    """
    Derive a 256-bit key from password using PBKDF2
    
    Returns: (key, salt)
    """
    if salt is None:
        salt = os.urandom(16)
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = kdf.derive(password.encode())
    
    return key, salt

def encrypt_payload(data: bytes, password: str) -> bytes:
    """
    Encrypt data using AES-256-GCM
    
    Format: salt (16) + nonce (12) + ciphertext + tag (16)
    """
    key, salt = derive_key(password)
    nonce = os.urandom(12)
    cipher = AESGCM(key)
    
    ciphertext = cipher.encrypt(nonce, data, None)
    
    # Combine: salt + nonce + ciphertext
    return salt + nonce + ciphertext

def decrypt_payload(encrypted_data: bytes, password: str) -> bytes:
    """
    Decrypt data encrypted with encrypt_payload
    """
    salt = encrypted_data[:16]
    nonce = encrypted_data[16:28]
    ciphertext = encrypted_data[28:]
    
    key, _ = derive_key(password, salt)
    cipher = AESGCM(key)
    
    plaintext = cipher.decrypt(nonce, ciphertext, None)
    
    return plaintext
