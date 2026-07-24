import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/tech_marketplace")
client = MongoClient(mongo_uri)
db = client.get_default_database() if "localhost" not in mongo_uri else client["tech_marketplace"]

print("--- CATEGORIES ---")
for cat in db["categories"].find():
    print(cat)

print("\n--- PROJECTS ---")
for proj in db["projects"].find():
    print(proj)
