import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

def run_migration():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/tech_marketplace")
    print("Running database migration...")
    client = MongoClient(mongo_uri)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["tech_marketplace"]

    # 1. Check if we need to migrate
    # If the domains collection already exists and has documents, but categories has docs and projects has no domainId, we migrate.
    # We can detect if there are projects without domainId.
    unmigrated_projects = list(db["projects"].find({"domainId": {"$exists": False}}))
    if not unmigrated_projects:
        print("All projects are already migrated or no unmigrated projects found.")
        return

    print(f"Found {len(unmigrated_projects)} unmigrated projects to migrate.")

    for legacy_proj in unmigrated_projects:
        title = legacy_proj.get("title", "Unnamed Domain")
        print(f"Migrating legacy domain/product '{title}'...")

        # Create new domain document (which is now the category)
        domain_doc = {
            "name": title,
            "description": legacy_proj.get("short_desc", legacy_proj.get("description", "")),
            "thumbnailUrl": legacy_proj.get("thumbnailUrl", ""),
            "createdAt": legacy_proj.get("created_at", datetime.utcnow()),
            "updatedAt": legacy_proj.get("updated_at", datetime.utcnow())
        }

        # Check if a domain with the same name already exists to avoid duplicates
        existing_domain = db["domains"].find_one({"name": title})
        if existing_domain:
            domain_id = existing_domain["_id"]
        else:
            res = db["domains"].insert_one(domain_doc)
            domain_id = res.inserted_id
            print(f"Created new domain '{title}' with ID {domain_id}")

        # Construct new project document (which is the actual product now)
        artifacts = legacy_proj.get("artifacts", []) or []
        files = []
        total_size = 0
        for art in artifacts:
            size_b = art.get("size_bytes", 0)
            total_size += size_b
            files.append({
                "name": art.get("name", art.get("label", "File")),
                "filename": art.get("filename"),
                "size": art.get("size", "Unknown"),
                "type": art.get("type", "FILE"),
                "size_bytes": size_b
            })

        # Technologies list mapping
        technologies = legacy_proj.get("technologies", [])
        if not technologies and legacy_proj.get("technology"):
            technologies = [t.strip() for t in legacy_proj["technology"].split(",") if t.strip()]

        project_doc = {
            "domainId": domain_id,
            "projectName": title + " Bundle" if "bundle" not in title.lower() else title,
            "description": legacy_proj.get("long_desc", legacy_proj.get("description", "")),
            "technologies": technologies,
            "difficulty": legacy_proj.get("difficulty_level", "Medium"),
            "price": legacy_proj.get("price_inr", legacy_proj.get("price", 0)),
            "thumbnailUrl": legacy_proj.get("thumbnailUrl", ""),
            "resourcesIncluded": legacy_proj.get("resourcesIncluded", []),
            "files": files,
            "totalFileSize": total_size,
            "downloadCount": legacy_proj.get("sales_count", legacy_proj.get("downloadCount", 0)),
            "rating": legacy_proj.get("rating", 5.0),
            "createdAt": legacy_proj.get("created_at", datetime.utcnow()),
            "updatedAt": legacy_proj.get("updated_at", datetime.utcnow())
        }

        # Replace/update the project document using the SAME _id as legacy project
        # This keeps the user purchases valid since they reference the project's _id!
        db["projects"].delete_one({"_id": legacy_proj["_id"]})
        project_doc["_id"] = legacy_proj["_id"]
        
        # Keep artifacts field for legacy code compatibility
        project_doc["artifacts"] = artifacts
        
        db["projects"].insert_one(project_doc)
        print(f"Migrated project bundle under domain '{title}' with project ID {legacy_proj['_id']}")

    print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
