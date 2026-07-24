from flask import Blueprint, current_app, send_from_directory, abort, request, jsonify
import os
from ..db import get_db, now_utc

bp = Blueprint("main", __name__)

@bp.post("/contact")
def create_contact_message():
    db = get_db()
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    email = (data.get("email") or "").strip().lower()
    message = (data.get("message") or "").strip()

    if not name or not mobile or not email or not message:
        return jsonify({"error": "Name, mobile, email, and message are required."}), 400

    msg_doc = {
        "name": name,
        "mobile": mobile,
        "email": email,
        "message": message,
        "status": "pending",
        "created_at": now_utc()
    }
    db["contact_messages"].insert_one(msg_doc)
    return jsonify({"success": True, "message": "Message received successfully."}), 201

@bp.get("/uploads/<path:key>")
def public_uploads(key: str):
    # Prevent directory traversal
    key = key.replace("..", "").replace("\\", "/").lstrip("/")
    
    # Check main upload folder
    base = os.path.abspath(current_app.config["UPLOAD_FOLDER"])
    file_path = os.path.join(base, key)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(base, key, as_attachment=False)
    
    # Check fallback subfolders inside app context
    fallback_path = os.path.join("app/uploads", key)
    if os.path.exists(fallback_path) and os.path.isfile(fallback_path):
        # Determine subdirectory path
        sub_dir = os.path.abspath(os.path.dirname(fallback_path))
        base_name = os.path.basename(fallback_path)
        return send_from_directory(sub_dir, base_name, as_attachment=False)
        
    abort(404)


@bp.get("/book-promotion")
def get_book_promotion():
    db = get_db()
    promo = db["book_promotions"].find_one({})
    if not promo:
        from datetime import datetime, timedelta
        promo = {
            "title": "Exclusive Student Reward",
            "description": "Purchase any project bundle from ProjectHub and unlock a FREE physical book from our official publishing partner.",
            "publisherName": "Official Publishing Partner",
            "publisherWebsite": "https://example.com/books",
            "couponCode": "FREEBOOKSTUDENT",
            "popupImage": "",
            "publisherLogo": "",
            "bannerImage": "",
            "isEnabled": True,
            "validTill": (now_utc() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "createdAt": now_utc(),
            "updatedAt": now_utc()
        }
        db["book_promotions"].insert_one(promo)
    
    # Serialize ObjectId
    promo["id"] = str(promo["_id"])
    del promo["_id"]
    
    # Format dates
    from datetime import datetime
    if isinstance(promo.get("createdAt"), datetime):
        promo["createdAt"] = promo["createdAt"].isoformat()
    if isinstance(promo.get("updatedAt"), datetime):
        promo["updatedAt"] = promo["updatedAt"].isoformat()
        
    return jsonify(promo), 200


@bp.get("/contact-info")
def get_contact_info():
    return jsonify({
        "contact_person": current_app.config.get("CONTACT_PERSON", "Mr. Raghuraj"),
        "phone": current_app.config.get("CONTACT_PHONE", "+91 9849258028"),
        "email": current_app.config.get("CONTACT_EMAIL", "raghuraj@hotmail.com"),
        "support_hours": "Monday – Saturday, 9:00 AM – 7:00 PM"
    }), 200

