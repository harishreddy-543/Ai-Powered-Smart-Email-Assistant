import sqlite3

def run_migration():
    conn = sqlite3.connect('backend/emails.db')
    c = conn.cursor()

    # 1. Paytm & Bill Payments -> Payments
    c.execute("""
        UPDATE emails 
        SET category = 'Payments' 
        WHERE (category = 'Unclassified' OR category IS NULL OR category = 'General') 
        AND (subject LIKE '%paytm%' OR subject LIKE '%bill%' OR subject LIKE '%invoice%' OR subject LIKE '%payment%' OR sender LIKE '%paytm%')
    """)

    # 2. Accenture, Job Vacancies, Naukri -> Education & Career
    c.execute("""
        UPDATE emails 
        SET category = 'Education & Career' 
        WHERE (category = 'Unclassified' OR category IS NULL OR category = 'General') 
        AND (subject LIKE '%job%' OR subject LIKE '%vacancy%' OR subject LIKE '%accenture%' OR subject LIKE '%naukri%' OR subject LIKE '%interview%' OR subject LIKE '%campus%' OR sender LIKE '%naukri%')
    """)

    # 3. Security Alerts -> Security & Account
    c.execute("""
        UPDATE emails 
        SET category = 'Security & Account' 
        WHERE (category = 'Unclassified' OR category IS NULL OR category = 'General') 
        AND (subject LIKE '%security%' OR subject LIKE '%password%' OR subject LIKE '%sign-in%' OR subject LIKE '%login%' OR sender LIKE '%google%')
    """)

    # 4. Remaining -> Updates & Notifications
    c.execute("""
        UPDATE emails 
        SET category = 'Updates & Notifications' 
        WHERE (category = 'Unclassified' OR category IS NULL OR category = 'General')
    """)

    conn.commit()

    c.execute("SELECT category, count(*) FROM emails GROUP BY category")
    rows = c.fetchall()
    print("MIGRATION COMPLETED SUCCESSFULLY!")
    print("UPDATED DB CATEGORIES:", rows)

if __name__ == "__main__":
    run_migration()
