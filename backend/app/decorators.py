from functools import wraps
from flask import request, jsonify, g 
from .auth import verify_token
from .models import User

def require_auth(f):
    @wraps(f)

    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "): 
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        
        token = auth_header.split(" ")[1]

        user_id = verify_token(token)

        if user_id is None:
            return jsonify({"error": "Token is invalid or expired"}), 401
        
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404
        
        g.current_user = user

        return f(*args, **kwargs)
    
    return decorated