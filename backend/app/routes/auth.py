from flask import Blueprint, request, jsonify, current_app, redirect, g
from bson import ObjectId
import time
import os

from ..db import get_db, now_utc
from ..security import (
    hash_password, verify_password, make_email_token, verify_email_token,
    limit_login, limit_register, generate_access_token, generate_refresh_token,
    decode_token, jwt_required
)
from ..mail import send_verification_email
from flask_mail import Message
from ..extensions import mail_ext

bp = Blueprint("auth", __name__)

@bp.post("/register")
def register():
    limit_register()
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""
    name = (data.get("name") or "").strip()

    if not email or not pw:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    if db["users"].find_one({"email": email}):
        return jsonify({"error": "Email is already registered."}), 400

    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    role = "super_admin" if email == super_admin_email else "user"
    is_admin = (role == "super_admin")

    user_doc = {
        "email": email,
        "name": name or email.split("@")[0],
        "password_hash": hash_password(pw),
        "is_verified": False,
        "is_admin": is_admin,
        "is_suspended": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    db["users"].insert_one(user_doc)

    # Generate verification token
    token = make_email_token(email)
    # The endpoint standard base url for Flask:
    flask_url = current_app.config["APP_BASE_URL"].rstrip("/")
    verify_url = f"{flask_url}/api/auth/verify-email/{token}"
    
    send_verification_email(email, verify_url)

    return jsonify({
        "message": "Registration successful! Please verify your email. A demo link has been logged in the backend console."
    }), 201

@bp.get("/verify-email/<token>")
def verify_email(token):
    email = verify_email_token(token)
    if not email:
        # Redirect to frontend with error flag
        frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:8080")
        return redirect(f"{frontend_url}/login?verified=false&reason=expired")

    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user:
        frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:8080")
        return redirect(f"{frontend_url}/login?verified=false&reason=usernotfound")

    db["users"].update_one(
        {"email": email},
        {"$set": {"is_verified": True, "updated_at": now_utc()}}
    )
    # Redirect to frontend login with success flag
    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:8080")
    return redirect(f"{frontend_url}/login?verified=true")

@bp.post("/login")
def login():
    limit_login()
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""

    if not email or not pw:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user or not verify_password(pw, user.get("password_hash", "")):
        return jsonify({"error": "Invalid email or password."}), 401

    if not user.get("is_verified", False):
        return jsonify({"error": "Please verify your email address before logging in."}), 403

    if user.get("is_suspended", False):
        return jsonify({"error": "Your account has been suspended."}), 403

    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    role = "super_admin" if email == super_admin_email else "user"
    user_id = str(user["_id"])

    # Generate JWT Tokens
    access_token = generate_access_token(user_id, email, role)
    refresh_token = generate_refresh_token(user_id)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "email": email,
            "name": user.get("name", email.split("@")[0]),
            "role": role
        }
    }), 200

@bp.post("/logout")
def logout():
    return jsonify({"message": "Logged out successfully"}), 200

@bp.post("/refresh")
def refresh():
    data = request.get_json(force=True, silent=True) or {}
    ref_token = data.get("refresh_token")
    if not ref_token:
        return jsonify({"error": "Refresh token is missing"}), 400

    payload = decode_token(ref_token)
    if payload == "expired":
        return jsonify({"error": "Refresh token has expired"}), 401
    if not payload or payload.get("type") != "refresh":
        return jsonify({"error": "Invalid refresh token"}), 401

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

    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    role = "super_admin" if user["email"].strip().lower() == super_admin_email else "user"
    new_access_token = generate_access_token(str(uid), user["email"], role)

    return jsonify({
        "access_token": new_access_token
    }), 200

@bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    db = get_db()
    user = db["users"].find_one({"email": email})
    # For security reasons, do not explicitly confirm if user does not exist
    if not user:
        return jsonify({"message": "If your email is registered, you will receive a password reset link shortly."}), 200

    # Generate standard reset token (reuse email verify logic with shorter expiration or separate type)
    token = make_email_token(email)
    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:8080")
    reset_url = f"{frontend_url}/reset-password?token={token}"

    # Send reset email
    server = current_app.config.get("MAIL_SERVER")
    username = current_app.config.get("MAIL_USERNAME")
    
    if server == "localhost" or not username:
        print("="*60)
        print("PASSWORD RESET (DEMO CONSOLE BYPASS)")
        print(f"To: {email}")
        print(f"Reset Link: {reset_url}")
        print("="*60)
    else:
        try:
            html_body = f"""
            <h3>Password Reset Request</h3>
            <p>You requested a password reset for your ProjectHub account. Click the button below to update your password:</p>
            <p><a href="{reset_url}" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a></p>
            <p>Or paste this URL in your browser: <br>{reset_url}</p>
            """
            msg = Message(
                subject="Reset your Password",
                recipients=[email],
                html=html_body
            )
            mail_ext.send(msg)
        except Exception as e:
            current_app.logger.error(f"Error sending password reset email: {e}")

    return jsonify({"message": "If your email is registered, you will receive a password reset link shortly."}), 200

@bp.post("/reset-password")
def reset_password():
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token")
    new_pw = data.get("password")

    if not token or not new_pw:
        return jsonify({"error": "Token and password are required."}), 400

    email = verify_email_token(token, max_age_seconds=1800)  # 30 mins limit for resets
    if not email:
        return jsonify({"error": "Reset link is invalid or expired."}), 400

    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found."}), 400

    db["users"].update_one(
        {"email": email},
        {"$set": {"password_hash": hash_password(new_pw), "updated_at": now_utc()}}
    )
    return jsonify({"message": "Password updated successfully"}), 200


@bp.get("/me")
@jwt_required
def get_me():
    """Return current authenticated user's profile."""
    user = g.current_user
    return jsonify({
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", user["email"].split("@")[0]),
        "role": "super_admin" if user["email"].strip().lower() == os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower() else "user",
        "is_verified": user.get("is_verified", False),
        "created_at": user["created_at"].isoformat() if hasattr(user.get("created_at"), "isoformat") else str(user.get("created_at", "")),
    }), 200


@bp.patch("/me")
@jwt_required
def update_me():
    """Update authenticated user's profile name and/or change password."""
    data = request.get_json(force=True, silent=True) or {}
    user = g.current_user
    db = get_db()
    uid = user["_id"]

    update_doc = {"updated_at": now_utc()}

    name = (data.get("name") or "").strip()
    if name:
        update_doc["name"] = name

    # Change password flow
    old_pw = data.get("old_password") or ""
    new_pw = data.get("new_password") or ""
    if new_pw:
        if not old_pw:
            return jsonify({"error": "Current password is required to change password."}), 400
        if not verify_password(old_pw, user.get("password_hash", "")):
            return jsonify({"error": "Current password is incorrect."}), 400
        if len(new_pw) < 6:
            return jsonify({"error": "New password must be at least 6 characters."}), 400
        update_doc["password_hash"] = hash_password(new_pw)

    if len(update_doc) == 1:  # only updated_at
        return jsonify({"message": "No changes to update."}), 200

    db["users"].update_one({"_id": uid}, {"$set": update_doc})
    return jsonify({"message": "Profile updated successfully."}), 200


@bp.get("/notifications")
@jwt_required
def get_notifications():
    """Fetch the current user's notifications."""
    db = get_db()
    uid = g.current_user["_id"]
    cursor = db["notifications"].find({"user_id": uid}).sort("created_at", -1).limit(50)
    notes = []
    for n in cursor:
        notes.append({
            "id": str(n["_id"]),
            "title": n.get("title", ""),
            "body": n.get("body", ""),
            "read": n.get("read", False),
            "date": n["created_at"].isoformat() if hasattr(n.get("created_at"), "isoformat") else str(n.get("created_at", "")),
        })
    return jsonify(notes), 200


@bp.post("/notifications/mark-read")
@jwt_required
def mark_notifications_read():
    """Mark all notifications as read for current user."""
    db = get_db()
    uid = g.current_user["_id"]
    db["notifications"].update_many({"user_id": uid, "read": False}, {"$set": {"read": True}})
    return jsonify({"message": "All notifications marked as read."}), 200
