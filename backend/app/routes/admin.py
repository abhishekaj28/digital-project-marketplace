from flask import Blueprint, request, jsonify, abort, current_app
from bson import ObjectId
from datetime import datetime, timedelta
import re

from pymongo.errors import DuplicateKeyError
from ..db import get_db, now_utc
from ..models import oid
from ..utils import slugify, allowed_ext, validate_uploaded_file
from ..storage import get_storage
from ..security import jwt_required, admin_required, super_admin_required, g
from .projects import serialize_project

bp = Blueprint("admin", __name__)

# -----------------
# Analytics endpoint
# -----------------
@bp.get("/analytics")
@jwt_required
@admin_required
def get_analytics():
    db = get_db()
    
    # Dynamic exact counts
    total_domains = db["domains"].count_documents({})
    total_projects = db["projects"].count_documents({})
    total_orders = db["purchases"].count_documents({"status": "completed"})
    total_downloads = db["downloads"].count_documents({})
    
    total_files = 0
    for proj in db["projects"].find({}):
        total_files += len(proj.get("files", []) or proj.get("artifacts", []) or [])

    # Recent Orders
    recent_orders = []
    recent_purchases = list(db["purchases"].find({"status": "completed"}).sort("created_at", -1).limit(8))
    for p in recent_purchases:
        user = db["users"].find_one({"_id": p.get("user_id")})
        project = db["projects"].find_one({"_id": p.get("project_id")})
        recent_orders.append({
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
            "date": p["created_at"].isoformat() if hasattr(p["created_at"], "isoformat") else str(p["created_at"])
        })

    return jsonify({
        "totalDomains": total_domains,
        "totalProjects": total_projects,
        "totalFiles": total_files,
        "totalOrders": total_orders,
        "totalDownloads": total_downloads,
        "recentOrders": recent_orders
    }), 200

# -----------------
# User management
# -----------------
@bp.get("/users")
@jwt_required
@admin_required
def list_users():
    db = get_db()
    users_list = list(db["users"].find({}).sort("created_at", -1))
    
    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    
    rows = []
    for u in users_list:
        purchases_cnt = db["purchases"].count_documents({"user_id": u["_id"], "status": "completed"})
        role = "super_admin" if u["email"].strip().lower() == super_admin_email else "user"
        rows.append({
            "id": str(u["_id"]),
            "name": u.get("name", u["email"].split("@")[0]),
            "email": u["email"],
            "role": role,
            "joined": u["created_at"].isoformat() if hasattr(u["created_at"], "isoformat") else str(u["created_at"]),
            "purchases": purchases_cnt,
            "status": "blocked" if u.get("is_suspended", False) else "active"
        })
    return jsonify(rows), 200

@bp.post("/users/<user_id>/toggle-admin")
@jwt_required
@admin_required
def toggle_admin(user_id):
    return jsonify({"error": "Multi-admin system is disabled. Only the owner super admin is allowed."}), 403

@bp.post("/users/<user_id>/toggle-suspend")
@jwt_required
@admin_required
def toggle_suspend(user_id):
    db = get_db()
    uid = oid(user_id)
    if not uid:
        return jsonify({"error": "Invalid user ID"}), 400

    if str(uid) == str(g.current_user["_id"]):
        return jsonify({"error": "You cannot suspend your own account."}), 400

    user = db["users"].find_one({"_id": uid})
    if not user:
        return jsonify({"error": "User not found"}), 404

    new_val = not bool(user.get("is_suspended", False))
    db["users"].update_one({"_id": uid}, {"$set": {"is_suspended": new_val, "updated_at": now_utc()}})
    return jsonify({"success": True, "message": f"User status has been set to {'blocked' if new_val else 'active'}."}), 200

# -----------------
# Orders / Purchases
# -----------------
@bp.get("/orders")
@bp.get("/transactions")
@jwt_required
@admin_required
def list_orders():
    db = get_db()
    cursor = db["purchases"].find({"status": "completed"}).sort("created_at", -1)
    
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
            "user": p.get("buyer_name") or (user.get("name", user["email"].split("@")[0]) if user else "Deleted User"),
            "email": p.get("email") or (user.get("email", "") if user else ""),
            "mobile": p.get("mobile") or (user.get("mobile", "—") if user else "—"),
            "college": p.get("college") or (user.get("college", "—") if user else "—"),
            "amount": p.get("price_inr", 0),
            "status": p.get("status", "pending"),
            "transactionId": p.get("razorpay_payment_id", f"ORD{str(p['_id'])[-6:].upper()}"),
            "razorpayOrderId": p.get("razorpay_order_id", ""),
            "razorpayPaymentId": p.get("razorpay_payment_id", ""),
            "date": p["created_at"].isoformat() if hasattr(p["created_at"], "isoformat") else str(p["created_at"]),
            "time": p["created_at"].strftime("%H:%M:%S") if hasattr(p["created_at"], "strftime") else "",
            "bookOfferUnlocked": p.get("bookOfferUnlocked", False),
            "couponCode": p.get("couponCode", ""),
            "publisherLink": p.get("publisherLink", ""),
            "publisherName": p.get("publisherName", ""),
            "purchaseDate": p.get("purchaseDate").isoformat() if p.get("purchaseDate") and hasattr(p.get("purchaseDate"), "isoformat") else str(p.get("purchaseDate") or "")
        })
    return jsonify(orders), 200

# -----------------
# Categories CRUD
# -----------------
# Domains CRUD
# -----------------
@bp.post("/categories")
@bp.post("/domains")
@jwt_required
@admin_required
def create_domain():
    db = get_db()
    
    # Extract request data robustly
    data = {}
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form or {}
        if not data and request.data:
            try:
                import json
                data = json.loads(request.data)
            except Exception:
                pass
                
    name = (data.get("name") or "").strip()
    category_name = (data.get("categoryName") or data.get("category_name") or data.get("category") or "").strip()
    category_id = (data.get("categoryId") or data.get("category_id") or category_name or "").strip()

    if not name:
        return jsonify({"error": "Required field missing: Domain name is required"}), 400
    if not category_name:
        return jsonify({"error": "Required field missing: Category is required"}), 400

    description = (data.get("description") or "").strip() or "No description provided."

    thumbnail_key = ""
    try:
        if request.files.get("thumbnail"):
            thumbnail = request.files["thumbnail"]
            if thumbnail.filename:
                storage = get_storage()
                thumbnail_key = storage.save(thumbnail, thumbnail.filename)
    except Exception as te:
        current_app.logger.exception("Thumbnail upload failed")
        return jsonify({"error": f"Thumbnail upload failed: {te}"}), 400

    domain_doc = {
        "categoryId": category_id,
        "categoryName": category_name,
        "name": name,
        "description": description,
        "thumbnailUrl": thumbnail_key,
        "createdAt": now_utc(),
        "updatedAt": now_utc()
    }
    
    try:
        db["domains"].insert_one(domain_doc)
    except DuplicateKeyError:
        return jsonify({"error": "Domain name already exists."}), 400
    except Exception as e:
        current_app.logger.exception("Database validation or save failed")
        return jsonify({"error": f"Database validation failed: {e}"}), 400
        
    return jsonify({"success": True, "message": "Domain created successfully."}), 201

@bp.put("/categories/<cat_id>")
@bp.put("/domains/<cat_id>")
@jwt_required
@admin_required
def edit_domain(cat_id):
    db = get_db()
    cid = oid(cat_id)
    if not cid:
        return jsonify({"error": "Invalid Domain ID"}), 400

    domain = db["domains"].find_one({"_id": cid})
    if not domain:
        return jsonify({"error": "Domain not found"}), 404

    # Extract body fields robustly
    data = {}
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form or {}
        if not data and request.data:
            try:
                import json
                data = json.loads(request.data)
            except Exception:
                pass

    name = (data.get("name") or "").strip() or domain.get("name")
    category_name = (data.get("categoryName") or data.get("category_name") or data.get("category") or "").strip() or domain.get("categoryName") or domain.get("category")
    category_id = (data.get("categoryId") or data.get("category_id") or category_name or "").strip() or domain.get("categoryId")
    description = (data.get("description") or "").strip() or domain.get("description")

    update_doc = {
        "categoryId": category_id,
        "categoryName": category_name,
        "name": name,
        "description": description,
        "updatedAt": now_utc()
    }

    try:
        if request.files.get("thumbnail"):
            thumbnail = request.files["thumbnail"]
            if thumbnail.filename:
                storage = get_storage()
                thumbnail_key = storage.save(thumbnail, thumbnail.filename)
                update_doc["thumbnailUrl"] = thumbnail_key
    except Exception as te:
        current_app.logger.exception("Thumbnail upload failed")
        return jsonify({"error": f"Thumbnail upload failed: {te}"}), 400

    try:
        db["domains"].update_one({"_id": cid}, {"$set": update_doc})
    except DuplicateKeyError:
        return jsonify({"error": "Domain name already exists."}), 400
    except Exception as e:
        current_app.logger.exception("Database validation or save failed")
        return jsonify({"error": f"Database validation failed: {e}"}), 400

    return jsonify({"success": True, "message": "Domain updated successfully."}), 200

@bp.delete("/categories/<cat_id>")
@bp.delete("/domains/<cat_id>")
@jwt_required
@admin_required
def delete_domain(cat_id):
    db = get_db()
    cid = oid(cat_id)
    if not cid:
        return jsonify({"error": "Invalid Domain ID"}), 400

    domain = db["domains"].find_one({"_id": cid})
    if not domain:
        return jsonify({"error": "Domain not found"}), 404

    # Check if there are projects in this domain
    proj_cnt = db["projects"].count_documents({"domainId": cid})
    if proj_cnt > 0:
        return jsonify({"error": "Delete all Projects before deleting this Domain."}), 400

    # Delete thumbnail
    if domain.get("thumbnailUrl"):
        try:
            get_storage().delete(domain["thumbnailUrl"])
        except Exception:
            pass

    db["domains"].delete_one({"_id": cid})
    return jsonify({"success": True, "message": "Domain deleted successfully."}), 200

# -----------------
# Projects CRUD
# -----------------
def process_project_files_and_fields_api(db, form, files, existing_project=None):
    storage = get_storage()
    title = (form.get("title") or "").strip()
    price = int(form.get("price") or form.get("price_inr") or "0")
    short_desc = (form.get("description") or form.get("short_desc") or "").strip()
    long_desc = (form.get("longDescription") or form.get("long_desc") or "").strip()
    category_id_raw = form.get("category_id") or form.get("category") or ""
    
    # Resolve category id — try ObjectId, then slug, then name (case-insensitive)
    cid = oid(category_id_raw)
    if not cid:
        # Try matching by name (case-insensitive)
        import re as _re
        cat_doc = db["domains"].find_one({"name": {"$regex": f"^{_re.escape(category_id_raw)}$", "$options": "i"}})
        if cat_doc:
            cid = cat_doc["_id"]

    slug = (form.get("slug") or "").strip() or slugify(title)
    
    # Cover image upload (Standardized on thumbnailUrl)
    existing_url = existing_project.get("thumbnailUrl", "") if existing_project else ""
    # For legacy docs that have cover_image but no thumbnailUrl, preserve the key
    if not existing_url and existing_project:
        legacy_key = existing_project.get("cover_image", "")
        if legacy_key:
            existing_url = legacy_key  # will be converted to full URL below
    cover_key = existing_url.split("/")[-1] if ("/" in existing_url and not existing_url.startswith("blob:")) else existing_url
    cover = files.get("thumbnail") or files.get("cover_image") or files.get("thumbnailUrl")
    if cover and cover.filename:
        err = validate_uploaded_file(cover, is_thumbnail=True)
        if err:
            raise ValueError(err)
        if existing_url and not existing_url.startswith("blob:"):
            try:
                storage.delete(existing_url)
            except Exception:
                pass
        cover_key = storage.save(cover, cover.filename)
        
    # Gallery images upload
    gallery = list(existing_project.get("gallery_images", [])) if existing_project else []
    for gi in files.getlist("gallery_images") or files.getlist("images"):
        if gi and gi.filename:
            err = validate_uploaded_file(gi, is_thumbnail=True)
            if err:
                raise ValueError(err)
            gallery.append(storage.save(gi, gi.filename))
            
    # Artifacts / Files (ZIP, PDF, PPT, etc.)
    artifacts = list(existing_project.get("files", []) or existing_project.get("artifacts", [])) if existing_project else []

    # Map specific file fields
    specific_files = [
        ("zipFile", "Source Code (ZIP)"),
        ("pdfReport", "Project Report (PDF)"),
        ("pptFile", "Presentation (PPTX)"),
        ("abstract", "Project Abstract (PDF)"),
        ("vivaQuestions", "Viva Questions (PDF)"),
        ("documentation", "README (TXT)")
    ]
    
    for file_field, label in specific_files:
        fs = files.get(file_field) or files.get(file_field.lower())
        if fs and fs.filename:
            err = validate_uploaded_file(fs, is_thumbnail=False)
            if err:
                raise ValueError(err)
            if existing_project:
                existing_idx = next((i for i, a in enumerate(artifacts) if a.get("label") == label), None)
                if existing_idx is not None:
                    old_fn = artifacts[existing_idx].get("filename")
                    try:
                        storage.delete(old_fn)
                    except Exception:
                        pass
                    artifacts.pop(existing_idx)
            
            key = storage.save(fs, fs.filename)
            
            # Calculate size
            size_bytes = 0
            try:
                import os
                if hasattr(storage, "full_path") and not key.startswith("http"):
                    path = storage.full_path(key)
                    if os.path.exists(path):
                        size_bytes = os.path.getsize(path)
            except Exception:
                pass

            if size_bytes > 0:
                if size_bytes < 1024:
                    size_str = f"{size_bytes} B"
                elif size_bytes < 1024*1024:
                    size_str = f"{(size_bytes / 1024):.1f} KB"
                else:
                    size_str = f"{(size_bytes / 1024 / 1024):.1f} MB"
            else:
                size_str = "Unknown"

            file_type = fs.filename.split(".")[-1].upper() if "." in fs.filename else "FILE"

            artifacts.append({
                "label": label,
                "name": fs.filename,
                "filename": key,
                "size": size_str,
                "type": file_type,
                "size_bytes": size_bytes
            })
            
    technologies_raw = form.get("technologies") or form.get("technology") or ""
    if isinstance(technologies_raw, str):
        technologies = [t.strip() for t in technologies_raw.split(",") if t.strip()]
    else:
        technologies = list(technologies_raw)

    difficulty_level = form.get("difficulty") or form.get("difficultyLevel") or form.get("difficulty_level") or "Medium"
    tags_raw = form.get("tags") or ""
    if isinstance(tags_raw, str):
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()]
    else:
        tags = list(tags_raw)

    status = (form.get("status") or "published").strip()
    is_featured = (form.get("featured") == "true" or form.get("featured") == "on" or form.get("is_featured") == "on")
    
    resources_raw = form.getlist("resourcesIncluded") or form.getlist("resourcesIncluded[]") or form.get("resourcesIncluded") or ""
    if isinstance(resources_raw, str):
        if resources_raw.startswith("["):
            import json
            try:
                resources_included = json.loads(resources_raw)
            except Exception:
                resources_included = [r.strip() for r in resources_raw.split(",") if r.strip()]
        else:
            resources_included = [r.strip() for r in resources_raw.split(",") if r.strip()]
    elif isinstance(resources_raw, list):
        resources_included = [r.strip() for r in resources_raw if r.strip()]
    else:
        resources_included = []

    resources_included = [r for r in resources_included if r]

    thumbnail_url = ""
    if cover_key:
        if cover_key.startswith("http"):
            thumbnail_url = cover_key
        else:
            base_url = current_app.config.get("APP_BASE_URL", "http://localhost:5000").rstrip("/")
            thumbnail_url = f"{base_url}/api/uploads/{cover_key}"

    # Calculate total size
    total_size = sum(art.get("size_bytes", 0) for art in artifacts)

    doc = {
        "projectName": title,
        "title": title, # Keep for legacy compatibility
        "price": price,
        "price_inr": price, # Keep for legacy compatibility
        "description": short_desc or long_desc,
        "short_desc": short_desc, # Keep for legacy compatibility
        "long_desc": long_desc, # Keep for legacy compatibility
        "domainId": cid,
        "category_id": cid, # Keep for legacy compatibility
        "thumbnailUrl": thumbnail_url,
        "gallery_images": gallery,
        "files": artifacts,
        "artifacts": artifacts, # Keep for legacy compatibility
        "totalFileSize": total_size,
        "slug": slug,
        "technologies": technologies,
        "resourcesIncluded": resources_included,
        "status": status,
        "is_featured": is_featured,
        "difficulty": difficulty_level,
        "difficulty_level": difficulty_level, # Keep for legacy compatibility
        "tags": tags,
        "updatedAt": now_utc(),
        "updated_at": now_utc() # Keep for legacy compatibility
    }
    
    if not existing_project:
        doc["createdAt"] = now_utc()
        doc["created_at"] = now_utc()
        doc["downloadCount"] = 0
        doc["sales_count"] = 0
        doc["rating"] = 5.0
        doc["reviewsCount"] = 0
        
    return doc

@bp.post("/projects")
@bp.post("/domains")
@jwt_required
@admin_required
def create_project():
    db = get_db()
    form = request.form
    files = request.files

    title = (form.get("title") or form.get("projectName") or "").strip()
    if not title:
        return jsonify({"error": "Project title is required."}), 400

    try:
        doc = process_project_files_and_fields_api(db, form, files)
        res = db["projects"].insert_one(doc)
        return jsonify({
            "success": True, 
            "message": "Project created successfully.", 
            "id": str(res.inserted_id),
            "thumbnailUrl": doc.get("thumbnailUrl", "")
        }), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to create project: {e}"}), 500

@bp.put("/projects/<project_id>")
@bp.put("/domains/<project_id>")
@jwt_required
@admin_required
def edit_project(project_id):
    db = get_db()
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    project = db["projects"].find_one({"_id": pid})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    form = request.form
    files = request.files

    try:
        update_doc = process_project_files_and_fields_api(db, form, files, existing_project=project)
        cleaned_update = {k: v for k, v in update_doc.items() if v is not None and v != ""}
        
        # Merge arrays/nested values
        if "thumbnailUrl" not in cleaned_update or not cleaned_update["thumbnailUrl"]:
            cleaned_update["thumbnailUrl"] = project.get("thumbnailUrl", "")
        if "gallery_images" not in cleaned_update or not cleaned_update["gallery_images"]:
            cleaned_update["gallery_images"] = project.get("gallery_images")
        if "files" not in cleaned_update or not cleaned_update["files"]:
            cleaned_update["files"] = project.get("files", []) or project.get("artifacts", [])
        if "artifacts" not in cleaned_update or not cleaned_update["artifacts"]:
            cleaned_update["artifacts"] = project.get("artifacts", []) or project.get("files", [])

        db["projects"].update_one({"_id": pid}, {"$set": cleaned_update})
        return jsonify({
            "success": True, 
            "message": "Project updated successfully.",
            "thumbnailUrl": cleaned_update["thumbnailUrl"]
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to update project: {e}"}), 500

@bp.delete("/projects/<project_id>")
@bp.delete("/domains/<project_id>")
@jwt_required
@admin_required
def delete_project(project_id):
    db = get_db()
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    project = db["projects"].find_one({"_id": pid})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    storage = get_storage()
    try:
        if project.get("thumbnailUrl"):
            storage.delete(project["thumbnailUrl"])
        for im in (project.get("gallery_images") or []):
            storage.delete(im)
            
        # Find all files belonging to the project and delete them
        project_files = list(db["files"].find({"projectId": pid}))
        for f in project_files:
            key = f.get("fileUrl")
            if key:
                storage.delete(key)
        
        # Delete file documents
        db["files"].delete_many({"projectId": pid})
    except Exception:
        pass

    db["projects"].delete_one({"_id": pid})
    return jsonify({"success": True, "message": "Project deleted successfully."}), 200

# -----------------
# Nested Project Files CRUD
# -----------------
@bp.post("/projects/<project_id>/files")
@bp.post("/domains/<project_id>/files")
@jwt_required
@admin_required
def upload_project_file(project_id):
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    db = get_db()
    proj = db["projects"].find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    if not request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No file part in the request"}), 400

    err = validate_uploaded_file(file, is_thumbnail=False)
    if err:
        return jsonify({"error": err}), 400

    storage = get_storage()
    key = storage.save(file, file.filename)

    # Calculate size
    size_bytes = 0
    try:
        import os
        if hasattr(storage, "full_path") and not key.startswith("http"):
            path = storage.full_path(key)
            if os.path.exists(path):
                size_bytes = os.path.getsize(path)
    except Exception:
        pass

    if size_bytes > 0:
        if size_bytes < 1024:
            size_str = f"{size_bytes} B"
        elif size_bytes < 1024*1024:
            size_str = f"{(size_bytes / 1024):.1f} KB"
        else:
            size_str = f"{(size_bytes / 1024 / 1024):.1f} MB"
    else:
        size_str = "Unknown"

    file_type = file.filename.split(".")[-1].upper() if "." in file.filename else "FILE"

    new_file = {
        "projectId": pid,
        "fileName": file.filename,
        "fileType": file_type,
        "fileSize": size_str,
        "fileUrl": key,
        "size_bytes": size_bytes
    }

    db["files"].insert_one(new_file)

    # Recalculate totalFileSize
    project_files = list(db["files"].find({"projectId": pid}))
    total_size = sum(f.get("size_bytes", 0) for f in project_files)

    db["projects"].update_one(
        {"_id": pid},
        {
            "$set": {
                "totalFileSize": total_size,
                "updatedAt": now_utc(),
                "updated_at": now_utc()
            }
        }
    )

    # Format return dictionary for compatibility
    new_file_compat = {
        "name": file.filename,
        "filename": key,
        "size": size_str,
        "type": file_type,
        "size_bytes": size_bytes
    }
    return jsonify({"success": True, "message": "File uploaded successfully.", "file": new_file_compat}), 201

@bp.put("/projects/<project_id>/files/<path:filename_key>")
@bp.put("/domains/<project_id>/files/<path:filename_key>")
@jwt_required
@admin_required
def rename_replace_project_file(project_id, filename_key):
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    db = get_db()
    proj = db["projects"].find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    # Find file document in the files collection
    file_doc = db["files"].find_one({"projectId": pid, "fileUrl": filename_key})
    if not file_doc:
        return jsonify({"error": "File not found in project"}), 404

    # Check if this is a replace file upload or a name change json request
    if request.files:
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "No file uploaded"}), 400

        err = validate_uploaded_file(file, is_thumbnail=False)
        if err:
            return jsonify({"error": err}), 400

        storage = get_storage()
        try:
            storage.delete(filename_key)
        except Exception:
            pass

        key = storage.save(file, file.filename)

        size_bytes = 0
        try:
            import os
            if hasattr(storage, "full_path") and not key.startswith("http"):
                path = storage.full_path(key)
                if os.path.exists(path):
                    size_bytes = os.path.getsize(path)
        except Exception:
            pass

        if size_bytes > 0:
            if size_bytes < 1024:
                size_str = f"{size_bytes} B"
            elif size_bytes < 1024*1024:
                size_str = f"{(size_bytes / 1024):.1f} KB"
            else:
                size_str = f"{(size_bytes / 1024 / 1024):.1f} MB"
        else:
            size_str = "Unknown"

        file_type = file.filename.split(".")[-1].upper() if "." in file.filename else "FILE"

        db["files"].update_one(
            {"_id": file_doc["_id"]},
            {"$set": {
                "fileName": file.filename,
                "fileType": file_type,
                "fileSize": size_str,
                "fileUrl": key,
                "size_bytes": size_bytes
            }}
        )
    else:
        data = request.get_json(force=True, silent=True) or {}
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return jsonify({"error": "New file name is required"}), 400

        orig_ext = file_doc["fileName"].split(".")[-1] if "." in file_doc["fileName"] else ""
        new_ext = new_name.split(".")[-1] if "." in new_name else ""
        if orig_ext and orig_ext.lower() != new_ext.lower():
            new_name = f"{new_name}.{orig_ext}"

        db["files"].update_one(
            {"_id": file_doc["_id"]},
            {"$set": {"fileName": new_name}}
        )

    # Recalculate totalFileSize
    project_files = list(db["files"].find({"projectId": pid}))
    total_size = sum(f.get("size_bytes", 0) for f in project_files)

    db["projects"].update_one(
        {"_id": pid},
        {"$set": {"totalFileSize": total_size, "updatedAt": now_utc(), "updated_at": now_utc()}}
    )
    return jsonify({"success": True, "message": "File updated successfully."}), 200

@bp.delete("/projects/<project_id>/files/<path:filename_key>")
@bp.delete("/domains/<project_id>/files/<path:filename_key>")
@jwt_required
@admin_required
def delete_project_file(project_id, filename_key):
    pid = oid(project_id)
    if not pid:
        return jsonify({"error": "Invalid project ID"}), 400

    db = get_db()
    proj = db["projects"].find_one({"_id": pid})
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    # Find file document in the files collection
    file_doc = db["files"].find_one({"projectId": pid, "fileUrl": filename_key})
    if not file_doc:
        return jsonify({"error": "File not found in project"}), 404

    storage = get_storage()
    try:
        storage.delete(filename_key)
    except Exception:
        pass

    db["files"].delete_one({"_id": file_doc["_id"]})

    # Recalculate totalFileSize
    project_files = list(db["files"].find({"projectId": pid}))
    total_size = sum(f.get("size_bytes", 0) for f in project_files)

    db["projects"].update_one(
        {"_id": pid},
        {"$set": {"totalFileSize": total_size, "updatedAt": now_utc(), "updated_at": now_utc()}}
    )
    return jsonify({"success": True, "message": "File deleted successfully."}), 200



# -----------------
# Admin Authentication
# -----------------
@bp.post("/register")
def admin_register():
    from ..security import hash_password, generate_access_token, generate_refresh_token
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
    
    if email != super_admin_email:
        return jsonify({"error": "Admin registration is restricted. Only the Super Admin can register."}), 403
        
    role = "super_admin"
    
    user_doc = {
        "email": email,
        "name": name or email.split("@")[0],
        "password_hash": hash_password(pw),
        "is_verified": True,
        "is_admin": True,
        "role": role,
        "is_suspended": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    db["users"].insert_one(user_doc)
    user_id = str(user_doc["_id"])
    access_token = generate_access_token(user_id, email, role)
    refresh_token = generate_refresh_token(user_id)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "email": email,
            "name": user_doc["name"],
            "role": role
        }
    }), 201


@bp.post("/login")
def admin_login():
    from ..security import verify_password, generate_access_token, generate_refresh_token
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""

    if not email or not pw:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user or not verify_password(pw, user.get("password_hash", "")):
        return jsonify({"error": "Invalid email or password."}), 401

    import os
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "raghuraj@projecthub.com").strip().lower()
    if email != super_admin_email:
        return jsonify({"error": "Admin privileges required. Access restricted to the Super Admin."}), 403

    if user.get("is_suspended", False):
        return jsonify({"error": "Your account has been suspended."}), 403

    role = "super_admin"
    user_id = str(user["_id"])

    # Automatically update role field in database if missing or out of sync
    if user.get("role") != role or not user.get("is_admin"):
        db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": {"role": role, "is_admin": True, "updated_at": now_utc()}}
        )

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


# -----------------
# File Manager CRUD
# -----------------
@bp.get("/files")
@jwt_required
@admin_required
def list_uploaded_files():
    db = get_db()
    files_list = list(db["uploaded_files"].find({}).sort("created_at", -1))
    rows = []
    for f in files_list:
        rows.append({
            "id": str(f["_id"]),
            "name": f.get("name", ""),
            "size": f.get("size", "0 MB"),
            "type": f.get("type", "FILE"),
            "key": f.get("key", ""),
            "progress": 100
        })
    return jsonify(rows), 200


@bp.post("/upload")
@jwt_required
@admin_required
def upload_file():
    import os
    if not request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files.get("file") or request.files.get("files")
    if not file or not file.filename:
        return jsonify({"error": "No file part in the request"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    is_thumb = ext in {"png", "jpg", "jpeg", "webp"}
    err = validate_uploaded_file(file, is_thumbnail=is_thumb)
    if err:
        return jsonify({"error": err}), 400

    storage = get_storage()
    key = storage.save(file, file.filename)
    
    size_bytes = 0
    try:
        if hasattr(storage, "full_path") and not key.startswith("http"):
            path = storage.full_path(key)
            if os.path.exists(path):
                size_bytes = os.path.getsize(path)
        else:
            size_bytes = request.content_length or 0
    except Exception:
        pass
    
    if size_bytes > 0:
        if size_bytes < 1024:
            size_str = f"{size_bytes} B"
        elif size_bytes < 1024*1024:
            size_str = f"{(size_bytes / 1024):.1f} KB"
        else:
            size_str = f"{(size_bytes / 1024 / 1024):.1f} MB"
    else:
        size_str = "Unknown"

    file_type = file.filename.split(".")[-1].upper() if "." in file.filename else "FILE"

    db = get_db()
    file_doc = {
        "name": file.filename,
        "size": size_str,
        "type": file_type,
        "key": key,
        "created_at": now_utc()
    }
    db["uploaded_files"].insert_one(file_doc)
    
    return jsonify({
        "success": True,
        "message": "File uploaded successfully.",
        "file": {
            "id": str(file_doc["_id"]),
            "name": file_doc["name"],
            "size": file_doc["size"],
            "type": file_doc["type"],
            "key": file_doc["key"]
        }
    }), 201


@bp.put("/files/<file_id>")
@jwt_required
@admin_required
def rename_uploaded_file(file_id):
    fid = oid(file_id)
    if not fid:
        return jsonify({"error": "Invalid file ID"}), 400

    data = request.get_json(force=True, silent=True) or {}
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "New file name is required"}), 400

    db = get_db()
    f = db["uploaded_files"].find_one({"_id": fid})
    if not f:
        return jsonify({"error": "File not found"}), 404

    orig_ext = f["name"].split(".")[-1] if "." in f["name"] else ""
    new_ext = new_name.split(".")[-1] if "." in new_name else ""
    if orig_ext and orig_ext.lower() != new_ext.lower():
        new_name = f"{new_name}.{orig_ext}"

    db["uploaded_files"].update_one(
        {"_id": fid},
        {"$set": {"name": new_name, "updated_at": now_utc()}}
    )
    return jsonify({"success": True, "message": "File renamed successfully."}), 200


@bp.delete("/files/<file_id>")
@jwt_required
@admin_required
def delete_uploaded_file(file_id):
    fid = oid(file_id)
    if not fid:
        return jsonify({"error": "Invalid file ID"}), 400

    db = get_db()
    f = db["uploaded_files"].find_one({"_id": fid})
    if not f:
        return jsonify({"error": "File not found"}), 404

    storage = get_storage()
    try:
        storage.delete(f["key"])
    except Exception:
        pass

    db["uploaded_files"].delete_one({"_id": fid})
    return jsonify({"success": True, "message": "File deleted successfully."}), 200


@bp.post("/files/<file_id>/replace")
@jwt_required
@admin_required
def replace_uploaded_file(file_id):
    import os
    fid = oid(file_id)
    if not fid:
        return jsonify({"error": "Invalid file ID"}), 400

    if not request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files.get("file") or request.files.get("files")
    if not file or not file.filename:
        return jsonify({"error": "No file part in the request"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    is_thumb = ext in {"png", "jpg", "jpeg", "webp"}
    err = validate_uploaded_file(file, is_thumbnail=is_thumb)
    if err:
        return jsonify({"error": err}), 400

    db = get_db()
    f = db["uploaded_files"].find_one({"_id": fid})
    if not f:
        return jsonify({"error": "File not found"}), 404

    storage = get_storage()
    try:
        storage.delete(f["key"])
    except Exception:
        pass

    key = storage.save(file, file.filename)
    
    size_bytes = 0
    try:
        if hasattr(storage, "full_path") and not key.startswith("http"):
            path = storage.full_path(key)
            if os.path.exists(path):
                size_bytes = os.path.getsize(path)
        else:
            size_bytes = request.content_length or 0
    except Exception:
        pass
    
    if size_bytes > 0:
        if size_bytes < 1024:
            size_str = f"{size_bytes} B"
        elif size_bytes < 1024*1024:
            size_str = f"{(size_bytes / 1024):.1f} KB"
        else:
            size_str = f"{(size_bytes / 1024 / 1024):.1f} MB"
    else:
        size_str = "Unknown"

    file_type = file.filename.split(".")[-1].upper() if "." in file.filename else "FILE"

    db["uploaded_files"].update_one(
        {"_id": fid},
        {"$set": {
            "name": file.filename,
            "size": size_str,
            "type": file_type,
            "key": key,
            "updated_at": now_utc()
        }}
    )
    return jsonify({"success": True, "message": "File replaced successfully."}), 200


# -----------------
# Contact Requests
# -----------------
@bp.get("/contacts")
@jwt_required
@admin_required
def list_contacts():
    db = get_db()
    cursor = db["contact_messages"].find({}).sort("created_at", -1)
    rows = []
    for c in cursor:
        rows.append({
            "id": str(c["_id"]),
            "name": c.get("name", ""),
            "mobile": c.get("mobile", ""),
            "email": c.get("email", ""),
            "message": c.get("message", ""),
            "status": c.get("status", "pending"),
            "date": c["created_at"].isoformat() if hasattr(c["created_at"], "isoformat") else str(c["created_at"])
        })
    return jsonify(rows), 200

@bp.post("/contacts/<contact_id>/toggle-status")
@jwt_required
@admin_required
def toggle_contact_status(contact_id):
    db = get_db()
    cid = oid(contact_id)
    if not cid:
        return jsonify({"error": "Invalid contact ID"}), 400
    
    contact = db["contact_messages"].find_one({"_id": cid})
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
        
    curr = contact.get("status", "pending")
    new_status = "resolved" if curr == "pending" else "pending"
    
    db["contact_messages"].update_one(
        {"_id": cid},
        {"$set": {"status": new_status, "updated_at": now_utc()}}
    )
    return jsonify({"success": True, "message": f"Status updated to {new_status}"}), 200


@bp.put("/book-promotion")
@jwt_required
@admin_required
def update_book_promotion():
    db = get_db()
    data = request.get_json(force=True, silent=True) or {}
    
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    publisher_name = data.get("publisherName", "").strip()
    publisher_website = data.get("publisherWebsite", "").strip()
    coupon_code = data.get("couponCode", "").strip()
    popup_image = data.get("popupImage", "").strip()
    publisher_logo = data.get("publisherLogo", "").strip()
    banner_image = data.get("bannerImage", "").strip()
    is_enabled = bool(data.get("isEnabled", False))
    valid_till = data.get("validTill", "").strip()
    
    if is_enabled and (not title or not publisher_name or not publisher_website or not coupon_code):
        return jsonify({"error": "When promotion is enabled, Title, Publisher Name, Publisher Website, and Coupon Code are required."}), 400
        
    update_doc = {
        "title": title,
        "description": description,
        "publisherName": publisher_name,
        "publisherWebsite": publisher_website,
        "couponCode": coupon_code,
        "popupImage": popup_image,
        "publisherLogo": publisher_logo,
        "bannerImage": banner_image,
        "isEnabled": is_enabled,
        "validTill": valid_till,
        "updatedAt": now_utc()
    }
    
    db["book_promotions"].update_one(
        {},
        {"$set": update_doc},
        upsert=True
    )
    
    return jsonify({"success": True, "message": "Book promotion settings updated successfully."}), 200
