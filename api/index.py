import sys
import os

# Add backend directory to sys.path so Vercel can import Flask modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import create_app

app = create_app()
