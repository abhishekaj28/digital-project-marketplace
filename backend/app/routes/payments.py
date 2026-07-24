from flask import Blueprint, request, jsonify, current_app, redirect, send_from_directory
from bson import ObjectId
import os
import razorpay
import secrets

from ..db import get_db, now_utc
from ..security import jwt_required, admin_required, g
from ..models import oid, is_purchase_completed
from ..payments import client as rp_client, inr_to_paise
from ..storage import get_storage
from ..mail import send_purchase_confirmation_email
from .projects import serialize_project

bp = Blueprint("payments", __name__)

@bp.post("/payments/create-order")
def create_order():
    current_app.logger.info("[PaymentPipeline] Step 1: POST /api/payments/create-order — Request received")

    # 1. Try to get user from Authorization token
    user = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        from ..security import decode_token
        try:
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload and payload != "expired" and payload.get("type") == "access":
                db = get_db()
                uid = ObjectId(payload["sub"])
                user = db["users"].find_one({"_id": uid})
                current_app.logger.info(f"[PaymentPipeline] Step 1: Authenticated user: {user.get('email') if user else 'not found'}")
        except Exception:
            pass

    # 2. Get body data
    data = request.get_json(force=True, silent=True) or {}
    project_id = data.get("projectId") or data.get("project_id") or data.get("domainId") or data.get("domain_id")
    
    # Buyer Details
    name = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    college = (data.get("college") or "").strip()
    email = (data.get("email") or "").strip().lower()

    current_app.logger.info(
        f"[PaymentPipeline] Step 2: Parsed request — project_id={project_id}, "
        f"name={name}, mobile={mobile[-4:] + '****' if mobile else 'missing'}, college={college}"
    )

    if not project_id:
        current_app.logger.error("[PaymentPipeline] Step 2: FAILED — Missing project/domain ID in request body")
        return jsonify({"error": "Missing project/domain ID"}), 400

    db = get_db()
    pid = oid(project_id)
    if not pid:
        # Fallback to slug lookup
        proj = db["projects"].find_one({"slug": project_id})
        if proj:
            pid = proj["_id"]
        else:
            current_app.logger.error(f"Invalid project ID or slug: {project_id}")
            return jsonify({"error": "Invalid project ID"}), 400
    else:
        proj = db["projects"].find_one({"_id": pid})

    if not proj:
        current_app.logger.error(f"Project not found: {project_id}")
        return jsonify({"error": "Project not found"}), 404

    # 3. Resolve or create user if not found
    access_token = None
    refresh_token = None

    if not user:
        # If no user session found, we register a guest user using buyer details
        if not name or not mobile or not college:
            current_app.logger.error("Missing guest buyer details for create-order")
            return jsonify({"error": "Name, mobile, and college are required for checkout."}), 400
        
        user_email = email or f"{mobile}@guest.projecthub.com"
        user = db["users"].find_one({"email": user_email})
        if not user:
            user = {
                "email": user_email,
                "name": name,
                "mobile": mobile,
                "college": college,
                "is_verified": True,
                "is_admin": False,
                "is_suspended": False,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
            db["users"].insert_one(user)
        else:
            # Update their name/mobile/college if they changed it
            db["users"].update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "name": name,
                    "mobile": mobile,
                    "college": college,
                    "updated_at": now_utc()
                }}
            )
            
        uid = user["_id"]
        from ..security import generate_access_token, generate_refresh_token
        access_token = generate_access_token(str(uid), user_email, "user")
        refresh_token = generate_refresh_token(str(uid))
    else:
        # User is logged in. If they provided details, we update their profile
        uid = user["_id"]
        update_fields = {}
        if name: update_fields["name"] = name
        if mobile: update_fields["mobile"] = mobile
        if college: update_fields["college"] = college
        if email: update_fields["email"] = email
        if update_fields:
            db["users"].update_one({"_id": uid}, {"$set": update_fields})
            user = db["users"].find_one({"_id": uid})

    # Check if already purchased
    if is_purchase_completed(uid, pid):
        current_app.logger.info(f"Project already purchased by user: project_id={project_id}, user={user['email']}")
        ret_val = {"already_owned": True}
        if access_token:
            ret_val["access_token"] = access_token
            ret_val["refresh_token"] = refresh_token
            ret_val["user"] = {
                "id": str(user["_id"]),
                "email": user["email"],
                "name": user.get("name", ""),
                "role": "user"
            }
        return jsonify(ret_val), 200

    price = proj.get("price_inr", proj.get("price", 0))
    amount_paise = inr_to_paise(int(price))
    if amount_paise <= 0:
        current_app.logger.error(f"Invalid project price: {price} for project_id={project_id}")
        return jsonify({"error": "Invalid project amount"}), 400

    is_mock = False
    order_id = ""
    key_id = (current_app.config.get("RAZORPAY_KEY_ID") or "").strip()
    key_secret = (current_app.config.get("RAZORPAY_KEY_SECRET") or "").strip()

    current_app.logger.info(
        f"[PaymentPipeline] Step 3: Creating Razorpay order — "
        f"key_id={key_id[:12] + '...' if key_id else '(empty)'}, "
        f"amount_paise={amount_paise}, project_id={project_id}"
    )

    try:
        if not key_id or not key_secret:
            raise Exception("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in .env")
        c = rp_client()
        order = c.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "project_id": str(pid),
                "user_id": str(uid),
            }
        })
        order_id = order["id"]
        current_app.logger.info(f"[PaymentPipeline] Step 4: ✅ Razorpay order created — order_id={order_id}")
    except Exception as e:
        current_app.logger.error(f"[PaymentPipeline] Razorpay order creation failed: {e}")
        return jsonify({"error": f"Unable to create Razorpay Order. Invalid Razorpay API configuration or network error: {e}"}), 502

    current_app.logger.info(f"Generated Razorpay Order: order_id={order_id}, amount={price}")

    # Fetch domain name for transaction history
    domain_name = ""
    if proj.get("domainId"):
        domain = db["domains"].find_one({"_id": proj.get("domainId")})
        if domain:
            domain_name = domain.get("name", "")

    ret_payload = {
        "success": True,
        "order_id": order_id,
        "orderId": order_id,
        # amount in INR (for display) AND amount_paise for Razorpay SDK
        "amount": price,
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": key_id,
        "keyId": key_id,
        "key": key_id,
        "domain_name": domain_name,
        "domainName": domain_name,
        "project_name": proj.get("projectName", proj.get("title", "")),
        "projectName": proj.get("projectName", proj.get("title", "")),
        "description": proj.get("projectName", proj.get("title", "")),
        "prefill": {
            "name": user.get("name", ""),
            "contact": user.get("mobile", ""),
            "email": user.get("email", "")
        },
        "notes": {"project_id": str(pid)},
        "is_mock": is_mock
    }

    current_app.logger.info(
        f"[PaymentPipeline] Step 4: Order response ready — "
        f"order_id={order_id}, amount_inr={price}, amount_paise={amount_paise}, is_mock={is_mock}"
    )
    
    if access_token:
        ret_payload["access_token"] = access_token
        ret_payload["refresh_token"] = refresh_token
        ret_payload["user"] = {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": "user"
        }
        
    return jsonify(ret_payload)

@bp.post("/payments/verify")
@jwt_required
def verify_payment():
    current_app.logger.info("[PaymentPipeline] Step 8: POST /api/payments/verify — Verification request received")

    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    current_app.logger.info(
        f"[PaymentPipeline] Step 8: Verifying payment — "
        f"order_id={order_id}, payment_id={payment_id}, "
        f"signature={'present' if signature else 'missing'}"
    )

    if not order_id or not payment_id:
        current_app.logger.error("[PaymentPipeline] Step 8: FAILED — Missing order_id or payment_id in verify request")
        return jsonify({"error": "Missing payment parameters"}), 400

    db = get_db()
    
    # Avoid duplicate verification
    existing_purchase = db["purchases"].find_one({"razorpay_order_id": order_id, "status": "completed"})
    if existing_purchase:
        current_app.logger.info(f"[PaymentPipeline] Order {order_id} already verified successfully previously.")
        return jsonify({"success": True}), 200

    # Retrieve buyer details and project identifier from request JSON or fallback to current user
    user = g.current_user
    uid = user["_id"]

    buyer_name = (data.get("name") or user.get("name") or "").strip()
    buyer_mobile = (data.get("mobile") or user.get("mobile") or "").strip()
    buyer_college = (data.get("college") or user.get("college") or "").strip()
    buyer_email = (data.get("email") or user.get("email") or "").strip().lower()
    project_id = data.get("projectId") or data.get("domainId")

    if not project_id:
        current_app.logger.error("[PaymentPipeline] Step 8: FAILED — Missing projectId in verify request data")
        return jsonify({"error": "Missing project/domain identifier"}), 400

    pid = oid(project_id)
    proj = None
    if pid:
        proj = db["projects"].find_one({"_id": pid})
    if not proj and project_id:
        proj = db["projects"].find_one({"slug": project_id})
        if proj:
            pid = proj["_id"]

    if not proj:
        current_app.logger.error(f"[PaymentPipeline] Step 8: FAILED — Project {project_id} not found in database")
        return jsonify({"error": "Project not found"}), 404

    price = proj.get("price_inr", proj.get("price", 0))
    amount_paise = inr_to_paise(int(price))

    is_verified = False
    if order_id.startswith("order_mock_"):
        is_verified = True
    else:
        try:
            c = rp_client()
            c.utility.verify_payment_signature({
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature
            })
            is_verified = True
        except Exception as e:
            current_app.logger.error(f"[PaymentPipeline] Payment Verification Failed: order_id={order_id}, payment_id={payment_id}, error={str(e)}")
            # Do NOT create database documents on verification failure
            return jsonify({"error": f"Verification failed: {str(e)}"}), 400

    if is_verified:
        current_app.logger.info(f"Payment Verification Result: SUCCESS for order_id={order_id}, payment_id={payment_id}")
        
        # Check active promotion
        promo = db["book_promotions"].find_one({"isEnabled": True})
        promo_data = {}
        if promo:
            promo_data = {
                "bookUnlocked": True,
                "bookOfferUnlocked": True,
                "couponCode": promo.get("couponCode", ""),
                "publisherWebsite": promo.get("publisherWebsite", ""),
                "publisherLink": promo.get("publisherWebsite", ""),
                "publisherName": promo.get("publisherName", ""),
                "publisherLogo": promo.get("publisherLogo", ""),
                "purchaseDate": now_utc()
            }
        else:
            promo_data = {
                "bookUnlocked": False,
                "bookOfferUnlocked": False,
                "couponCode": "",
                "publisherWebsite": "",
                "publisherLink": "",
                "publisherName": "",
                "publisherLogo": "",
                "purchaseDate": None
            }

        # Domain metadata
        domain_name = ""
        category_name = "Engineering & Technology"
        if proj.get("domainId"):
            domain = db["domains"].find_one({"_id": proj.get("domainId")})
            if domain:
                domain_name = domain.get("name", "")
                category_name = domain.get("category", "") or domain.get("category_name", category_name)

        proj_title = proj.get("projectName", proj.get("title", "Digital Project"))

        now = now_utc()
        purchase_date_str = now.strftime("%Y-%m-%d")
        purchase_time_str = now.strftime("%H:%M:%S")

        # 1. Insert into purchases (for backwards-compatibility & download tracking)
        purchase = {
            "user_id": uid,
            "project_id": pid,
            "status": "completed", 
            "price_inr": price,
            "amount_paise": amount_paise,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "buyer_name": buyer_name,
            "mobile": buyer_mobile,
            "college": buyer_college,
            "email": buyer_email,
            "domain_purchased": domain_name,
            "project_purchased": proj_title,
            "amount": price,
            "currency": "INR",
            "payment_status": "paid",
            "purchase_date": now,
            "transaction_date": now,
            "coupon_unlocked": promo_data.get("bookUnlocked", False),
            "book_coupon_status": "unlocked" if promo_data.get("bookUnlocked", False) else "locked",
            "download_status": "unlocked",
            "created_at": now,
            "updated_at": now,
            **promo_data
        }
        db["purchases"].insert_one(purchase)

        # 2. Insert into orders (for standardized schemas)
        db["orders"].insert_one({
            "user_id": uid,
            "user_email": buyer_email,
            "project_id": pid,
            "project_title": proj_title,
            "amount": price,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "status": "completed", 
            "payment_status": "paid",
            "buyer_name": buyer_name,
            "mobile": buyer_mobile,
            "college": buyer_college,
            "email": buyer_email,
            "domain_purchased": domain_name,
            "project_purchased": proj_title,
            "currency": "INR",
            "purchase_date": now,
            "transaction_date": now,
            "coupon_unlocked": promo_data.get("bookUnlocked", False),
            "book_coupon_status": "unlocked" if promo_data.get("bookUnlocked", False) else "locked",
            "download_status": "unlocked",
            "created_at": now
        })

        # 3. Save details in the transactions collection as requested specifically
        transaction = {
            "buyer_name": buyer_name,
            "mobile_number": buyer_mobile,
            "email": buyer_email,
            "college_name": buyer_college,
            "category": category_name,
            "domain": domain_name,
            "project_purchased": proj_title,
            "amount": price,
            "razorpay_payment_id": payment_id,
            "razorpay_order_id": order_id,
            "payment_status": "PAID",
            "purchase_date": purchase_date_str,
            "purchase_time": purchase_time_str,
            "created_at": now,
            "updated_at": now
        }
        db["transactions"].insert_one(transaction)

        current_app.logger.info(f"[PaymentPipeline] Step 9: Database entries inserted for order_id={order_id}")

        # Increment sales count
        db["projects"].update_one(
            {"_id": pid},
            {"$inc": {"sales_count": 1}}
        )

        # Trigger notification
        db["notifications"].insert_one({
            "user_id": uid,
            "title": "Purchase successful",
            "body": f"You can now download the assets for \"{proj_title}\".",
            "read": False,
            "created_at": now
        })

        # Send confirmation email
        user_name = buyer_name or buyer_email.split('@')[0]
        frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
        download_url = f"{frontend_url}/payment-success?txn={payment_id}"
        send_purchase_confirmation_email(buyer_email, user_name, proj_title, price, download_url)
        
        current_app.logger.info(f"[PaymentPipeline] Step 9: ✅ Verification complete — success. Transaction saved.")
        return jsonify({"success": True}), 200

@bp.get("/purchases")
@jwt_required
def get_purchases():
    db = get_db()
    uid = g.current_user["_id"]
    cursor = db["purchases"].find({"user_id": uid, "status": "completed"}).sort("created_at", -1)
    
    rows = []
    for p in cursor:
        proj = db["projects"].find_one({"_id": p.get("project_id")})
        if not proj:
            continue
        rows.append({
            "id": str(p["_id"]),
            "project": serialize_project(proj, db),
            "amount": p.get("price_inr", 0),
            "date": p["created_at"].isoformat() if hasattr(p["created_at"], "isoformat") else str(p["created_at"]),
            "status": p.get("status"),
            "razorpay_payment_id": p.get("razorpay_payment_id")
        })
    return jsonify(rows), 200

@bp.get("/downloads")
@jwt_required
def get_downloads():
    db = get_db()
    uid = g.current_user["_id"]
    
    # Get all completed purchases for files mapping
    cursor = db["purchases"].find({"user_id": uid, "status": "completed"}).sort("created_at", -1)
    downloads_list = []
    for p in cursor:
        proj = db["projects"].find_one({"_id": p.get("project_id")})
        if not proj:
            continue
        
        serialized = serialize_project(proj, db)
        downloads_list.append({
            "projectId": str(proj["_id"]),
            "projectTitle": proj.get("title", ""),
            "thumbnail": serialized.get("thumbnail", ""),
            "files": [
                {"label": "Source Code (ZIP)", "url": serialized.get("zipFile")},
                {"label": "Project Report (PDF)", "url": serialized.get("pdfReport")},
                {"label": "Presentation (PPT)", "url": serialized.get("pptFile")},
                {"label": "Documentation", "url": serialized.get("documentation")},
                {"label": "Viva Questions", "url": serialized.get("vivaQuestions")},
                {"label": "Abstract", "url": serialized.get("abstract")}
            ]
        })
    return jsonify(downloads_list), 200

@bp.get("/payments/download/<project_id>/<path:filename>")
@jwt_required
def download_artifact(project_id, filename):
    db = get_db()
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    proj = db["projects"].find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    user = g.current_user
    uid = user["_id"]

    # Verify purchase ownership
    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    is_super_admin = (user.get("email", "").strip().lower() == super_admin_email)
    if not is_purchase_completed(uid, pid) and not is_super_admin:
        return jsonify({"error": "You do not own this project."}), 403

    # Check if file exists in the project artifacts
    artifact = None
    for art in proj.get("artifacts", []) or []:
        if art.get("filename") == filename:
            artifact = art
            break

    if not artifact:
        # Fallback search matching filename base
        for art in proj.get("artifacts", []) or []:
            if os.path.basename(art.get("filename", "")) == os.path.basename(filename):
                artifact = art
                break

    if not artifact:
        return jsonify({"error": "Artifact file not found in project"}), 404

    # Log to downloads collection
    db["downloads"].insert_one({
        "user_id": uid,
        "user_email": user["email"],
        "project_id": pid,
        "project_title": proj.get("title", ""),
        "artifact_label": artifact.get("label", "File"),
        "filename": filename,
        "downloaded_at": now_utc()
    })

    # Increment downloadCount
    db["projects"].update_one(
        {"_id": pid},
        {"$inc": {"downloadCount": 1, "sales_count": 1}}
    )

    storage = get_storage()
    # Check if CloudinaryStorage or LocalStorage
    if filename.startswith("http"):
        return redirect(filename)

    presigned = storage.presigned_download_url(filename)
    if presigned:
        return redirect(presigned)

    # LocalStorage handling
    # Check if UPLOAD_FOLDER is app/uploads or absolute
    base_folder = os.path.abspath(current_app.config["UPLOAD_FOLDER"])
    # Check uploads/demo placeholders
    file_path = os.path.join(base_folder, filename)
    if not os.path.exists(file_path):
        # Check relative fallback in app context
        fallback_path = os.path.join("app/uploads", filename)
        if os.path.exists(fallback_path):
            return send_from_directory(os.path.abspath("app/uploads"), filename, as_attachment=True)
        return jsonify({"error": "Physical file does not exist on server disk"}), 404

    return send_from_directory(base_folder, filename, as_attachment=True)


@bp.post("/orders/create")
def create_guest_order():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    college = (data.get("college") or "").strip()
    email = (data.get("email") or "").strip().lower()
    domain_id = data.get("domainId") or data.get("domain_id")

    if not name or not mobile or not college or not domain_id:
        return jsonify({"error": "Name, mobile, college, and domainId are required."}), 400

    db = get_db()
    pid = oid(domain_id)
    if not pid:
        # Fallback to slug lookup
        proj = db["projects"].find_one({"slug": domain_id})
        if proj:
            pid = proj["_id"]
        else:
            return jsonify({"error": "Invalid domain ID"}), 400
    else:
        proj = db["projects"].find_one({"_id": pid})

    if not proj:
        return jsonify({"error": "Domain not found."}), 404

    # Resolve or create guest user
    user_email = email or f"{mobile}@guest.projecthub.com"
    user = db["users"].find_one({"email": user_email})
    if not user:
        user = {
            "email": user_email,
            "name": name,
            "mobile": mobile,
            "college": college,
            "is_verified": True,
            "is_admin": False,
            "is_suspended": False,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        db["users"].insert_one(user)
    else:
        db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": {
                "name": name,
                "mobile": mobile,
                "college": college,
                "updated_at": now_utc()
            }}
        )

    uid = user["_id"]

    # Generate JWT Token for this session
    from ..security import generate_access_token, generate_refresh_token
    access_token = generate_access_token(str(uid), user_email, "user")
    refresh_token = generate_refresh_token(str(uid))

    price = proj.get("price_inr", proj.get("price", 0))

    return jsonify({
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(uid),
            "email": user_email,
            "name": name,
            "role": "user"
        },
        "order": {
            "domainId": str(pid),
            "amount": price,
            "status": "pending"
        }
    }), 201


@bp.get("/download/<domain_id>")
@jwt_required
def download_domain_zip(domain_id):
    db = get_db()
    pid = oid(domain_id)
    if not pid:
        # Fallback to slug lookup
        proj = db["projects"].find_one({"slug": domain_id})
        if proj:
            pid = proj["_id"]
        else:
            return jsonify({"error": "Invalid domain ID"}), 400
    else:
        proj = db["projects"].find_one({"_id": pid})

    if not proj:
        return jsonify({"error": "Domain not found"}), 404

    user = g.current_user
    uid = user["_id"]

    # Verify purchase ownership
    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    is_super_admin = (user.get("email", "").strip().lower() == super_admin_email)
    if not is_purchase_completed(uid, pid) and not is_super_admin:
        return jsonify({"error": "You do not own this project."}), 403

    # Find all files in the project from files collection
    artifacts = list(db["files"].find({"projectId": pid}))
    if not artifacts:
        return jsonify({"error": "No downloadable resources are available for this project yet."}), 404

    # Log to downloads collection
    db["downloads"].insert_one({
        "user_id": uid,
        "user_email": user["email"],
        "project_id": pid,
        "project_title": proj.get("projectName", proj.get("title", "")),
        "artifact_label": "Project ZIP Archive",
        "downloaded_at": now_utc()
    })

    # Increment downloadCount
    db["projects"].update_one(
        {"_id": pid},
        {"$inc": {"downloadCount": 1, "sales_count": 1}}
    )

    # Dynamically zip files on the fly
    import zipfile
    import io
    from flask import send_file

    base_folder = os.path.abspath(current_app.config["UPLOAD_FOLDER"])
    memory_file = io.BytesIO()
    
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for art in artifacts:
            filename = art.get("fileUrl") # This is the unique key saved on disk
            original_name = art.get("fileName") or filename
            
            # Resolve path
            file_path = os.path.join(base_folder, filename)
            if not os.path.exists(file_path):
                file_path = os.path.join(os.path.abspath("app/uploads"), filename)
                
            if os.path.exists(file_path):
                zip_file.write(file_path, original_name)
                
    memory_file.seek(0)
    slug = proj.get("slug") or str(pid)
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{slug}-bundle.zip"
    )


@bp.get("/transactions")
@jwt_required
@admin_required
def list_transactions_root():
    db = get_db()
    cursor = db["purchases"].find({}).sort("created_at", -1)
    
    orders = []
    for p in cursor:
        user = db["users"].find_one({"_id": p.get("user_id")})
        project = db["projects"].find_one({"_id": p.get("project_id")})
        orders.append({
            "id": f"ORD{str(p['_id'])[-6:].upper()}",
            "orderId": str(p["_id"]),
            "projectId": str(p.get("project_id")),
            "projectTitle": project.get("projectName", project.get("title", "Digital Project")) if project else p.get("project_purchased", "Digital Project"),
            "domainName": p.get("domain_purchased", ""),
            "user": user.get("name", user["email"].split("@")[0]) if user else "Deleted User",
            "email": user.get("email", "") if user else "",
            "mobile": user.get("mobile", "—") if user else "—",
            "college": user.get("college", "—") if user else "—",
            "amount": p.get("price_inr", 0),
            "status": p.get("status", "pending"),
            "transactionId": p.get("razorpay_payment_id", f"ORD{str(p['_id'])[-6:].upper()}"),
            "razorpayOrderId": p.get("razorpay_order_id", ""),
            "razorpayPaymentId": p.get("razorpay_payment_id", ""),
            "couponCode": p.get("couponCode", ""),
            "bookUnlocked": p.get("bookUnlocked", p.get("bookOfferUnlocked", False)),
            "bookOfferUnlocked": p.get("bookOfferUnlocked", False),
            "publisherName": p.get("publisherName", ""),
            "publisherLogo": p.get("publisherLogo", ""),
            "publisherWebsite": p.get("publisherWebsite", p.get("publisherLink", "")),
            "date": p["created_at"].isoformat() if hasattr(p["created_at"], "isoformat") else str(p["created_at"]),
            "time": p["created_at"].strftime("%H:%M:%S") if hasattr(p["created_at"], "strftime") else ""
        })

    return jsonify(orders), 200


@bp.get("/orders/<order_id>")
@jwt_required
def get_order_details(order_id):
    db = get_db()
    # Search by razorpay_order_id, razorpay_payment_id, or _id
    query = {
        "user_id": g.current_user["_id"],
        "$or": [
            {"razorpay_order_id": order_id},
            {"razorpay_payment_id": order_id}
        ]
    }
    try:
        if ObjectId.is_valid(order_id):
            query["$or"].append({"_id": ObjectId(order_id)})
    except Exception:
        pass

    purchase = db["purchases"].find_one(query)
    if not purchase:
        # Check order collection too
        order_query = {
            "user_id": g.current_user["_id"],
            "$or": [
                {"razorpay_order_id": order_id},
                {"razorpay_payment_id": order_id}
            ]
        }
        order = db["orders"].find_one(order_query)
        if not order:
            return jsonify({"error": "Order not found"}), 404
        purchase = order

    return jsonify({
        "id": str(purchase.get("_id")),
        "razorpay_order_id": purchase.get("razorpay_order_id"),
        "razorpay_payment_id": purchase.get("razorpay_payment_id"),
        "bookUnlocked": purchase.get("bookUnlocked", purchase.get("bookOfferUnlocked", False)),
        "bookOfferUnlocked": purchase.get("bookOfferUnlocked", False),
        "couponCode": purchase.get("couponCode", ""),
        "publisherWebsite": purchase.get("publisherWebsite", purchase.get("publisherLink", "")),
        "publisherLink": purchase.get("publisherLink", ""),
        "publisherName": purchase.get("publisherName", ""),
        "publisherLogo": purchase.get("publisherLogo", ""),
        "purchaseDate": purchase.get("purchaseDate").isoformat() if purchase.get("purchaseDate") and hasattr(purchase.get("purchaseDate"), "isoformat") else str(purchase.get("purchaseDate") or ""),
        "status": purchase.get("status"),
        "amount": purchase.get("price_inr") or purchase.get("amount", 0),
    }), 200


@bp.post("/orders")
def post_orders():
    # Helper to support both authenticated orders and guest checkout
    auth_header = request.headers.get("Authorization")
    if auth_header:
        from ..security import decode_token
        try:
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload and payload.get("role") == "user":
                db = get_db()
                user = db["users"].find_one({"_id": ObjectId(payload["sub"])})
                if user:
                    from flask import g
                    g.current_user = user
                    return create_order()
        except Exception:
            pass
    return create_guest_order()
