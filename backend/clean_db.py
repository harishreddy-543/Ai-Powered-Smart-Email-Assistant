import sqlite3
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Email

engine = create_engine("sqlite:///emails.db")
Session = sessionmaker(bind=engine)
session = Session()

emails = session.query(Email).all()
updated_count = 0

for email in emails:
    if not email.body:
        continue
    original_body = email.body
    
    # Very aggressive CSS removal heuristic since tags are gone
    # Look for patterns like `body { ... }` or `@media ... { ... }`
    
    # Remove CSS-like blocks with braces
    # This might catch valid text if it uses braces, but emails rarely use { } unless they are code or CSS
    # Let's remove anything that looks like CSS selectors and braces
    
    cleaned = re.sub(r'(@media[^{]+\{[\s\S]*?\}\s*\})', ' ', original_body)
    cleaned = re.sub(r'([.#a-zA-Z0-9-_:,>\s]+)\s*\{[^\}]*\}', ' ', cleaned)
    
    # Also remove common leftover CSS properties that might not have braces matched properly
    cleaned = re.sub(r'(margin|padding|color|font-family|font-size|font-weight|line-height|width|height|display|text-align|background|border)[-a-zA-Z]*\s*:[^;]+;', ' ', cleaned)
    
    # Collapse multiple spaces
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    
    if cleaned != original_body:
        email.body = cleaned
        updated_count += 1

session.commit()
session.close()

print(f"Cleaned {updated_count} emails in the database.")
