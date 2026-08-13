import sqlite3
import re
import os

def clean_html_text(html: str) -> str:
    if not html:
        return ""
    # Remove script and style blocks entirely
    cleaned = re.sub(r'(?is)<(script|style).*?>.*?</\1>', ' ', html)
    # Remove all remaining HTML tags
    cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
    # Decode common HTML entities
    cleaned = cleaned.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    # Collapse multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # But wait, the existing DB bodies ALREADY had the HTML tags stripped!
    # So `body { font-family: ... }` does NOT have <style> tags anymore!
    # We can't use `clean_html_text` on already-stripped text because the tags are gone.
    return cleaned.strip()

print("This approach won't work on already stripped text.")
