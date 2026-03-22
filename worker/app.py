from flask import Flask, request, jsonify
import os
import logging
from datetime import datetime
import base64

# Import steganography services
from services.lsb_embed import embed_lsb, extract_lsb
from services.dct_embed import embed_dct, extract_dct
from services.encryption import encrypt_payload, decrypt_payload
from services.analysis import estimate_capacity, get_visual_metrics

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


def encode_bytes(payload: bytes) -> str:
    return base64.b64encode(payload).decode('utf-8')


def decode_embedded_length(payload: bytes) -> int:
    return int.from_bytes(payload[:4], 'big')


def wrap_payload(encrypted_payload: bytes) -> bytes:
    return len(encrypted_payload).to_bytes(4, 'big') + encrypted_payload


@app.route('/analyze', methods=['POST'])
def analyze_handler():
    try:
        if 'carrier' not in request.files:
            return jsonify({'error': 'Missing carrier file'}), 400

        carrier_file = request.files['carrier']
        carrier_bytes = carrier_file.read()
        payload_size = int(request.form.get('payload_size', 0))
        mime_type = carrier_file.mimetype or 'application/octet-stream'
        estimated_capacity = estimate_capacity(carrier_bytes, mime_type)
        recommended_method = 'dct' if mime_type == 'image/jpeg' else 'lsb'

        return jsonify({
            'status': 'success',
            'estimated_capacity_bytes': estimated_capacity,
            'payload_size_bytes': payload_size,
            'capacity_used_percent': round((payload_size / estimated_capacity) * 100, 4) if payload_size else 0,
            'recommended_method': recommended_method,
        }), 200
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Embed payload into carrier (LSB method)
@app.route('/embed/lsb', methods=['POST'])
def embed_lsb_handler():
    """
    Embed encrypted payload into PNG carrier using LSB method
    
    Request:
    - carrier: Binary carrier image (PNG)
    - payload: Binary payload to encrypt and embed
    - password: Encryption password
    """
    try:
        if 'carrier' not in request.files or 'payload' not in request.files:
            return jsonify({'error': 'Missing carrier or payload file'}), 400
        
        carrier_file = request.files['carrier']
        payload_file = request.files['payload']
        password = request.form.get('password', 'default')
        carrier_bytes = carrier_file.read()
        payload_bytes = payload_file.read()

        # Encryption
        encrypted_payload = encrypt_payload(payload_bytes, password)
        wrapped_payload = wrap_payload(encrypted_payload)

        # Embedding
        result_image = embed_lsb(
            carrier_bytes,
            wrapped_payload
        )

        metrics = get_visual_metrics(carrier_bytes, result_image)
        capacity = estimate_capacity(carrier_bytes, carrier_file.mimetype or 'image/png')

        logger.info(f"LSB embedding successful")
        return jsonify({
            'method': 'lsb',
            'status': 'success',
            'carrier_size': len(carrier_bytes),
            'payload_size': len(payload_bytes),
            'encrypted_payload_size': len(encrypted_payload),
            'capacity_used_percent': round((len(wrapped_payload) / capacity) * 100, 4),
            'carrier_base64': encode_bytes(result_image),
            'visual_metrics': metrics,
        }), 200
    
    except Exception as e:
        logger.error(f"LSB embedding failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Embed payload into carrier (DCT method)
@app.route('/embed/dct', methods=['POST'])
def embed_dct_handler():
    """
    Embed encrypted payload into JPEG carrier using DCT method
    
    Request:
    - carrier: Binary carrier image (JPEG)
    - payload: Binary payload to encrypt and embed
    - password: Encryption password
    - quality: JPEG quality factor (1-100)
    """
    try:
        if 'carrier' not in request.files or 'payload' not in request.files:
            return jsonify({'error': 'Missing carrier or payload file'}), 400
        
        carrier_file = request.files['carrier']
        payload_file = request.files['payload']
        password = request.form.get('password', 'default')
        quality = int(request.form.get('quality', 85))
        carrier_bytes = carrier_file.read()
        payload_bytes = payload_file.read()

        # Encryption
        encrypted_payload = encrypt_payload(payload_bytes, password)

        # Embedding
        result_image = embed_dct(
            carrier_bytes,
            wrap_payload(encrypted_payload),
            quality=quality
        )

        metrics = get_visual_metrics(carrier_bytes, result_image)
        capacity = estimate_capacity(carrier_bytes, carrier_file.mimetype or 'image/jpeg')

        logger.info(f"DCT embedding successful")
        return jsonify({
            'method': 'dct',
            'status': 'success',
            'carrier_size': len(carrier_bytes),
            'payload_size': len(payload_bytes),
            'encrypted_payload_size': len(encrypted_payload),
            'quality': quality
            ,
            'capacity_used_percent': round((len(encrypted_payload) / capacity) * 100, 4),
            'carrier_base64': encode_bytes(result_image),
            'visual_metrics': metrics,
        }), 200
    
    except Exception as e:
        logger.error(f"DCT embedding failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Extract payload from carrier
@app.route('/extract', methods=['POST'])
def extract_handler():
    """
    Extract and decrypt payload from carrier
    
    Request:
    - carrier: Binary carrier image
    - method: Extraction method (lsb or dct)
    - password: Decryption password
    """
    try:
        if 'carrier' not in request.files:
            return jsonify({'error': 'Missing carrier file'}), 400
        
        carrier_file = request.files['carrier']
        method = request.form.get('method', 'lsb')
        password = request.form.get('password', 'default')
        carrier_bytes = carrier_file.read()

        if method == 'lsb':
            header = extract_lsb(carrier_bytes, 4)
            encrypted_payload_length = decode_embedded_length(header)
            wrapped_payload = extract_lsb(carrier_bytes, encrypted_payload_length + 4)
            encrypted_payload = wrapped_payload[4:]
        elif method == 'dct':
            header = extract_dct(carrier_bytes, 4)
            encrypted_payload_length = decode_embedded_length(header)
            wrapped_payload = extract_dct(carrier_bytes, encrypted_payload_length + 4)
            encrypted_payload = wrapped_payload[4:]
        else:
            return jsonify({'error': f'Unsupported extraction method: {method}'}), 400

        decrypted_payload = decrypt_payload(encrypted_payload, password)

        logger.info(f"Extraction via {method} successful")
        return jsonify({
            'method': method,
            'status': 'success',
            'payload_size': len(decrypted_payload),
            'payload_base64': encode_bytes(decrypted_payload),
        }), 200
    
    except Exception as e:
        logger.error(f"Extraction failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('WORKER_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
