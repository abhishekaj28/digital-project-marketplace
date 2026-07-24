import os
import sys
from datetime import datetime
from pymongo import MongoClient

# Set up system path so we can import from backend app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.security import hash_password

def seed_database():
    print("Connecting to MongoDB...")
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/tech_marketplace")
    client = MongoClient(mongo_uri)
    
    # Extract DB name from URI or use default
    try:
        db = client.get_default_database()
    except Exception:
        db = client["tech_marketplace"]

    print(f"Using database: {db.name}")

    # 1. Clear Collections
    print("Clearing existing collections...")
    db["users"].drop()
    db["categories"].drop()
    db["domains"].drop()
    db["projects"].drop()
    db["files"].drop()
    db["purchases"].drop()
    db["orders"].drop()
    db["webhook_events"].drop()
    db["audit_logs"].drop()
    db["downloads"].drop()

    # 2. Seed Users
    print("Seeding super admin user...")
    admin_pw = hash_password("Admin@123")
    
    admin_id = db["users"].insert_one({
        "email": "raghuraj@projecthub.com",
        "name": "Super Admin",
        "password_hash": admin_pw,
        "is_admin": True,
        "role": "super_admin",
        "is_verified": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }).inserted_id

    # 3. Seed Default Categories (Fixed List)
    print("Seeding categories...")
    categories_list = [
        "Engineering & Technology",
        "Commerce & Business Management",
        "Medicine & Healthcare Sciences",
        "Arts, Humanities & Social Sciences",
        "Pure & Applied Sciences",
        "Law & Legal Studies",
        "Architecture, Design & Fine Arts",
        "Agricultural & Environmental Sciences",
        "Hospitality, Tourism & Culinary Arts",
        "Media, Journalism & Communications"
    ]
    
    category_ids = {}
    for cat_name in categories_list:
        cat_id = db["categories"].insert_one({
            "name": cat_name,
            "description": f"Academic resources for {cat_name}.",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }).inserted_id
        category_ids[cat_name] = cat_id

    # 4. Seed Domains (linked to Categories)
    print("Seeding domains...")
    domains_data = [
        {
            "name": "Artificial Intelligence",
            "categoryName": "Engineering & Technology",
            "description": "State-of-the-art AI systems, neural networks, machine learning models and computer vision assets."
        },
        {
            "name": "Cyber Security",
            "categoryName": "Engineering & Technology",
            "description": "Ethical hacking resources, cryptography tools, penetration testing templates and security scripts."
        },
        {
            "name": "Business Analytics",
            "categoryName": "Commerce & Business Management",
            "description": "E-commerce data models, financial forecasting tools, and predictive statistics dashboards."
        }
    ]

    domain_ids = {}
    for dom in domains_data:
        cat_id = category_ids.get(dom["categoryName"])
        dom_id = db["domains"].insert_one({
            "categoryId": cat_id,
            "categoryName": dom["categoryName"],
            "name": dom["name"],
            "description": dom["description"],
            "thumbnailUrl": "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }).inserted_id
        domain_ids[dom["name"]] = dom_id

    # 5. Seed Projects (linked to Domains)
    print("Seeding projects...")
    projects_data = [
        {
            "domainName": "Artificial Intelligence",
            "projectName": "AI Resume Screening System",
            "description": "An automated resume screener parsing PDFs and ranking applicants using TF-IDF and NLP techniques.",
            "price": 499,
            "technologies": ["Python", "Flask", "NLTK", "Scikit-Learn"],
            "difficulty": "Medium",
            "resourcesIncluded": ["Source Code", "Notes", "Documentation", "PPT", "Viva Questions"]
        },
        {
            "domainName": "Artificial Intelligence",
            "projectName": "Face Recognition Attendance Tracker",
            "description": "Real-time face recognition and attendance management system utilizing OpenCV and Deep Learning embeddings.",
            "price": 999,
            "technologies": ["Python", "OpenCV", "PyTorch", "SQLite"],
            "difficulty": "Hard",
            "resourcesIncluded": ["Source Code", "Notes", "Documentation", "PPT", "Viva Questions", "Abstract"]
        },
        {
            "domainName": "Cyber Security",
            "projectName": "Network Intrusion Detection Tool",
            "description": "Anomaly-based network intrusion detection system capturing raw packet data and detecting threats.",
            "price": 1499,
            "technologies": ["Python", "Scapy", "Pandas", "Wireshark"],
            "difficulty": "Hard",
            "resourcesIncluded": ["Source Code", "Documentation", "Research Paper", "Abstract"]
        }
    ]

    project_ids = {}
    for proj in projects_data:
        dom_id = domain_ids.get(proj["domainName"])
        proj_id = db["projects"].insert_one({
            "domainId": dom_id,
            "projectName": proj["projectName"],
            "title": proj["projectName"],
            "description": proj["description"],
            "price": proj["price"],
            "price_inr": proj["price"],
            "thumbnailUrl": "",
            "technologies": proj["technologies"],
            "difficulty": proj["difficulty"],
            "difficulty_level": proj["difficulty"],
            "resourcesIncluded": proj["resourcesIncluded"],
            "totalFileSize": 0,
            "downloadCount": 0,
            "sales_count": 0,
            "rating": 5.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }).inserted_id
        project_ids[proj["projectName"]] = proj_id

    # 6. Seed Files (linked to Projects)
    print("Seeding files...")
    files_data = [
        {
            "projectName": "AI Resume Screening System",
            "fileName": "resume_screener_source.zip",
            "fileType": "ZIP",
            "fileSize": "14.5 MB",
            "fileUrl": "demo/ipl_source.zip",
            "size_bytes": 15204352
        },
        {
            "projectName": "AI Resume Screening System",
            "fileName": "project_report.pdf",
            "fileType": "PDF",
            "fileSize": "2.1 MB",
            "fileUrl": "demo/ipl_report.pdf",
            "size_bytes": 2202009
        },
        {
            "projectName": "Face Recognition Attendance Tracker",
            "fileName": "face_rec_attendance_tracker.zip",
            "fileType": "ZIP",
            "fileSize": "22.1 MB",
            "fileUrl": "demo/cyber_source.zip",
            "size_bytes": 23173529
        }
    ]

    for f in files_data:
        proj_id = project_ids.get(f["projectName"])
        if proj_id:
            db["files"].insert_one({
                "projectId": proj_id,
                "fileName": f["fileName"],
                "fileType": f["fileType"],
                "fileSize": f["fileSize"],
                "fileUrl": f["fileUrl"]
            })
            # Increment totalFileSize of the project
            db["projects"].update_one(
                {"_id": proj_id},
                {"$inc": {"totalFileSize": f["size_bytes"]}}
            )

    print("Seeding complete! Database is clean and ready.")

if __name__ == "__main__":
    seed_database()
