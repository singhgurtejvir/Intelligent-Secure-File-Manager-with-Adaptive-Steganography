"""
Least Significant Bit (LSB) steganography for PNG images
"""
import numpy as np
from PIL import Image
import io

def embed_lsb(carrier_bytes: bytes, payload: bytes, color_bits: int = 2) -> bytes:
    """
    Embed encrypted payload into PNG carrier using LSB method
    
    Args:
        carrier_bytes: PNG image binary data
        payload: Encrypted payload to embed
        color_bits: Number of LSBs to use per color channel (1-8)
    
    Returns:
        Modified PNG image as bytes
    """
    # Load carrier image
    carrier_img = Image.open(io.BytesIO(carrier_bytes))
    carrier_array = np.array(carrier_img)
    
    # Check capacity
    max_bits = carrier_array.size * color_bits
    payload_bits = len(payload) * 8
    
    if payload_bits > max_bits:
        raise ValueError(
            f'Payload too large. Max capacity: {max_bits // 8} bytes, '
            f'payload: {len(payload)} bytes'
        )
    
    # Flatten array for easier bit manipulation
    flat = carrier_array.flatten()
    
    # Convert payload to bit string
    payload_bits_str = ''.join(format(byte, f'0{8}b') for byte in payload)
    
    # Create mask for LSBs
    lsb_mask = (1 << color_bits) - 1
    clear_mask = ~lsb_mask & 0xFF
    
    # Embed bits
    bit_index = 0
    for i in range(len(flat)):
        if bit_index >= len(payload_bits_str):
            break
        
        # Get next color_bits bits from payload
        if bit_index + color_bits <= len(payload_bits_str):
            payload_bits_chunk = payload_bits_str[bit_index:bit_index + color_bits]
        else:
            # Pad with zeros if necessary
            payload_bits_chunk = payload_bits_str[bit_index:].ljust(color_bits, '0')
        
        # Clear LSBs and embed new bits
        flat[i] = (flat[i] & clear_mask) | int(payload_bits_chunk, 2)
        bit_index += color_bits
    
    # Reshape and save
    result_array = flat.reshape(carrier_array.shape).astype(np.uint8)
    result_img = Image.fromarray(result_array)
    
    # Save as PNG (lossless)
    output = io.BytesIO()
    result_img.save(output, format='PNG')
    
    return output.getvalue()

def extract_lsb(carrier_bytes: bytes, payload_size: int, color_bits: int = 2) -> bytes:
    """
    Extract encrypted payload from PNG carrier
    
    Args:
        carrier_bytes: PNG image binary data
        payload_size: Expected payload size in bytes
        color_bits: Number of LSBs used in embedding
    
    Returns:
        Extracted encrypted payload
    """
    carrier_img = Image.open(io.BytesIO(carrier_bytes))
    carrier_array = np.array(carrier_img)
    
    flat = carrier_array.flatten()
    
    # Extract bits
    extracted_bits = []
    lsb_mask = (1 << color_bits) - 1
    
    for i in range(len(flat)):
        if len(extracted_bits) >= payload_size * 8:
            break
        
        # Extract LSBs
        lsb_value = flat[i] & lsb_mask
        bits = format(lsb_value, f'0{color_bits}b')
        extracted_bits.append(bits)
    
    # Convert back to bytes
    payload_bits_str = ''.join(extracted_bits)[:payload_size * 8]
    
    payload = bytes(
        int(payload_bits_str[i:i+8], 2) 
        for i in range(0, len(payload_bits_str), 8)
    )
    
    return payload
