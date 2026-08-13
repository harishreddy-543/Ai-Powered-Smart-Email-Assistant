import sqlite3
import os

def alter_db():
    db_path = "emails.db"
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE preferences ADD COLUMN fcm_token VARCHAR")
        print("Added fcm_token to preferences")
    except Exception as e:
        print(f"Error adding fcm_token (might exist): {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    alter_db()
