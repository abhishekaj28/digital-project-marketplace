import hashlib
import hmac
import os
import time
import jwt
from collections import defaultdict, deque
from functools import wraps
from flask import current_app, request, abort, jsonify, g
from itsdangerous import URLSafeTimedSerializer
from bson import ObjectId
import bcrypt

from .db import get_db

# -----------------------
# Password Hashing & Email Tokens
# -----------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, stored: str) -> bool:
    if not password or not stored:
        return False
    try:
        if ":" in stored:
            salt_hex, dk_hex = stored.split(":")
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(dk_hex)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
            return hmac.compare_digest(dk, expected)
        return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
    except Exception:
        return False

def signer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="email-verify")

def make_email_token(email: str) -> str:
    return signer().dumps({"email": email})

def verify_email_token(token: str, max_age_seconds: int = 3600*24) -> str | None:
    try:
        data = signer().loads(token, max_age=max_age_seconds)
        return data.get("email")
    except Exception:
        return None

# -----------------------
# JWT Authentication Helpers
# -----------------------
def generate_access_token(user_id: str, email: str, role: str) -> str:
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY", "dev-secret")
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": time.time() + 15 * 60,  # 15 minutes
        "iat": time.time(),
        "type": "access"
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def generate_refresh_token(user_id: str) -> str:
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY", "dev-secret")
    payload = {
        "sub": str(user_id),
        "exp": time.time() + 7 * 24 * 3600,  # 7 days
        "iat": time.time(),
        "type": "refresh"
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def decode_token(token: str):
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY", "dev-secret")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return "expired"
    except Exception:
        return None

# -----------------------
# JWT Authentication Middleware
# -----------------------
def jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        endpoint = request.endpoint
        path = request.path
        method = request.method
        current_app.logger.info(f"[AUTH AUDIT] Attempting access to: {method} {path} ({endpoint})")
        
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: Missing/invalid Authorization header.")
            return jsonify({"error": "Authentication required. Missing token."}), 401
        
        token = auth_header.split(" ")[1]
        current_app.logger.info(f"[AUTH AUDIT] Received Token: {token[:15]}...")
        
        payload = decode_token(token)
        if payload == "expired":
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: Token expired.")
            return jsonify({"error": "Token has expired"}), 401
        if not payload or payload.get("type") != "access":
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: Token type mismatch or decode error. Decoded: {payload}")
            return jsonify({"error": "Invalid token"}), 401
        
        current_app.logger.info(f"[AUTH AUDIT] Decoded Token Payload: {payload}")
        
        db = get_db()
        try:
            uid = ObjectId(payload["sub"])
        except Exception:
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: Invalid sub in token.")
            return jsonify({"error": "Invalid user identification"}), 401
            
        user = db["users"].find_one({"_id": uid})
        if not user:
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: User not found in database.")
            return jsonify({"error": "User not found"}), 401
        if user.get("is_suspended"):
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: User account is suspended.")
            return jsonify({"error": "Account is suspended"}), 403
            
        g.current_user = user
        current_app.logger.info(f"[AUTH AUDIT] User verified: email={user.get('email')}, role={payload.get('role')}")
        return fn(*args, **kwargs)
    return wrapper

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        endpoint = request.endpoint
        path = request.path
        method = request.method
        user = getattr(g, "current_user", None)
        
        if not user:
            current_app.logger.info(f"[AUTH AUDIT] admin_required executing token verification for: {method} {path} ({endpoint})")
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                current_app.logger.warning("[AUTH AUDIT] Rejecting admin request: Missing/invalid header.")
                return jsonify({"error": "Authentication required. Missing token."}), 401
            
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload == "expired":
                current_app.logger.warning("[AUTH AUDIT] Rejecting admin request: Token expired.")
                return jsonify({"error": "Token has expired"}), 401
            if not payload or payload.get("type") != "access":
                current_app.logger.warning("[AUTH AUDIT] Rejecting admin request: Invalid token payload.")
                return jsonify({"error": "Invalid token"}), 401
            
            db = get_db()
            try:
                uid = ObjectId(payload["sub"])
            except Exception:
                return jsonify({"error": "Invalid user identification"}), 401
                
            user = db["users"].find_one({"_id": uid})
            if not user:
                return jsonify({"error": "User not found"}), 401
            if user.get("is_suspended"):
                return jsonify({"error": "Account is suspended"}), 403
            
            g.current_user = user

        current_app.logger.info(f"[AUTH AUDIT] Verifying admin status: email={user.get('email')}, is_admin={user.get('is_admin')}, role={user.get('role')}")
        if not user.get("is_admin", False):
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: User {user.get('email')} lacks is_admin flag.")
            return jsonify({"error": "Admin privileges required"}), 403
            
        current_app.logger.info(f"[AUTH AUDIT] Admin role check passed.")
        return fn(*args, **kwargs)
    return wrapper

def super_admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        endpoint = request.endpoint
        path = request.path
        method = request.method
        user = getattr(g, "current_user", None)
        
        if not user:
            current_app.logger.info(f"[AUTH AUDIT] super_admin_required executing token verification for: {method} {path} ({endpoint})")
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                current_app.logger.warning("[AUTH AUDIT] Rejecting super admin request: Missing header.")
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload == "expired":
                current_app.logger.warning("[AUTH AUDIT] Rejecting super admin request: Token expired.")
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            if not payload or payload.get("type") != "access":
                current_app.logger.warning("[AUTH AUDIT] Rejecting super admin request: Invalid token.")
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            
            db = get_db()
            try:
                uid = ObjectId(payload["sub"])
            except Exception:
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
                
            user = db["users"].find_one({"_id": uid})
            if not user:
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            if user.get("is_suspended"):
                return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            
            g.current_user = user

        super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
        current_app.logger.info(f"[AUTH AUDIT] Verifying super admin email: email={user.get('email')}, expected={super_admin_email}")
        if not user or user.get("email", "").strip().lower() != super_admin_email:
            current_app.logger.warning(f"[AUTH AUDIT] Rejecting request: User {user.get('email')} is not the super admin email {super_admin_email}.")
            return jsonify({"error": "Unauthorized Access", "message": "Unauthorized Access"}), 403
            
        current_app.logger.info(f"[AUTH AUDIT] Super admin role check passed successfully.")
        return fn(*args, **kwargs)
    return wrapper

# -----------------------
# In-memory Rate Limiting
# -----------------------
_BUCKETS = defaultdict(lambda: deque())

def rate_limit(key: str, limit_per_minute: int):
    now = time.time()
    q = _BUCKETS[key]
    while q and (now - q[0]) > 60:
        q.popleft()
    if len(q) >= limit_per_minute:
        abort(429)
    q.append(now)

def limit_login():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    rate_limit(f"login:{ip}", current_app.config["RATE_LIMIT_LOGIN_PER_MIN"])

def limit_register():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    rate_limit(f"register:{ip}", current_app.config["RATE_LIMIT_REGISTER_PER_MIN"])
