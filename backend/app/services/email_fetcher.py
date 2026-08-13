import time
import random
import imaplib
import email
from email.utils import parsedate_to_datetime
import datetime
from email.header import decode_header
from sqlalchemy.orm import Session
from typing import Dict, List, Any

import os
from dotenv import load_dotenv
load_dotenv()
from app.core.config import settings
from app.services.agent_service import AgentService, log_agent_activity

# Templates for simulated emails
SIMULATED_TEMPLATES = {
    "placement": [
        {
            "sender": "placements@college.edu",
            "subject": "TCS Campus Recruitment 2026",
            "body": "Dear Students,\n\nTCS campus recruitment registration is now open.\n\nStudents interested in the Data Analyst position must complete registration before August 5 at 6 PM.\n\nAssessment will be conducted on August 7.\n\nRegards,\nPlacement Cell"
        }
    ],
    "interview": [
        {
            "sender": "hr@techcorp.com",
            "subject": "Data Analyst Interview Confirmation",
            "body": "Your interview is scheduled tomorrow at 11 AM. Please confirm your attendance."
        }
    ],
    "education": [
        {
            "sender": "admin@university.edu",
            "subject": "Final Reminder: Exam Registration Closes Today",
            "body": "This is a reminder that the registration portal for the upcoming semester exams will close today at 11:59 PM. Ensure you have paid your fees and submitted the forms."
        }
    ],
    "phishing": [
        {
            "sender": "security@g00gle-account.xyz",
            "subject": "URGENT - Your Google Account Will Be Suspended",
            "body": "Your account has been compromised.\n\nVerify your password immediately:\n\nhttps://g00gle-account.xyz/login"
        }
    ],
    "spam": [
        {
            "sender": "marketing@super-deals-now.com",
            "subject": "≡ƒöÑ MEGA SALE - 90% OFF!!!",
            "body": "Buy now and receive another product FREE!\n\nLimited offer!\nClick here now!\nhttp://super-deals-now.com/buy"
        }
    ],
    "marketing": [
        {
            "sender": "newsletter@designweekly.com",
            "subject": "Your Weekly UI/UX Inspiration",
            "body": "Welcome to this week's newsletter. We cover the top 10 design trends for mobile apps in 2026. Read the full article on our blog."
        }
    ],
    "otp": [
        {
            "sender": "no-reply@auth.services.com",
            "subject": "Your Login Verification Code",
            "body": "Your OTP for login is: 482910\n\nThis code will expire in 10 minutes. Do not share this code with anyone."
        }
    ],
    "security_safe": [
        {
            "sender": "no-reply@accounts.google.com",
            "subject": "Security Alert: New Sign-in",
            "body": "A new sign-in was detected on your account from a Windows device in New York. If this was you, you don't need to do anything. If not, secure your account immediately."
        }
    ]
}

def simulate_incoming_email(db: Session, user_id: int, sim_type: str = "random") -> Dict[str, Any]:
    """Generates a random email from templates and runs it through the agent pipeline"""
    if sim_type == "random" or sim_type not in SIMULATED_TEMPLATES:
        sim_type = random.choice(list(SIMULATED_TEMPLATES.keys()))
        
    # Create a copy so we don't mutate the global template
    template = dict(random.choice(SIMULATED_TEMPLATES[sim_type]))
    
    # Fetch user preferences and dynamically inject them into the simulation!
    prefs = db.query(models.Preferences).filter(models.Preferences.user_id == user_id).first()
    if prefs and sim_type in ["placement", "interview"]:
        companies = [c.strip() for c in prefs.favorite_companies.split(',')] if prefs.favorite_companies else ["TechCorp"]
        roles = [r.strip() for r in prefs.career_interests.split(',')] if prefs.career_interests else ["Software Engineer"]
        company = random.choice(companies)
        role = random.choice(roles)
        
        template["subject"] = template["subject"].replace("TCS", company).replace("Data Analyst", role)
        template["body"] = template["body"].replace("TCS", company).replace("Data Analyst", role)
    
    # Add a slight variation to sender/subject to make database entries unique
    variation = random.randint(100, 999)
    sender = template["sender"]
    subject = f"{template['subject']} ({variation})"
    body = f"{template['body']}\n\n[Ref ID: {variation}]"
    
    # Process email via agent pipeline
    db_email = AgentService.process_new_email(
        db=db,
        user_id=user_id,
        sender=sender,
        recipient="user@assistant-inbox.com",
        subject=subject,
        body=body
    )
    
    db_email.is_simulated = True
    db.commit()
    
    return {
        "id": db_email.id,
        "sender": db_email.sender,
        "subject": db_email.subject,
        "category": db_email.category,
        "priority": db_email.priority
    }

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.models import models
from app.core import security
import base64

def sync_real_emails(db: Session, user_id: int):
    """
    Connects to IMAP or Gmail API to download recent emails and ingest them.
    Uses dynamic credentials from the User model.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        log_agent_activity("IMAP_SYNC", "User not found.")
        return
        
    if user.google_access_token:
        # Use Gmail API
        log_agent_activity("GMAIL_API", f"Syncing emails via Google OAuth for {user.email}...")
        try:
            creds_data = {
                'token': user.google_access_token,
                'refresh_token': user.google_refresh_token,
                'token_uri': 'https://oauth2.googleapis.com/token',
                'client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
                'client_secret': os.getenv('GOOGLE_CLIENT_SECRET', ''),
                'scopes': ['https://www.googleapis.com/auth/gmail.readonly']
            }
            creds = Credentials.from_authorized_user_info(creds_data)
            service = build('gmail', 'v1', credentials=creds)
            
            # Fetch all messages with pagination
            messages = []
            request = service.users().messages().list(userId='me', maxResults=500)
            pages = 0
            while request is not None and pages < 2:
                response = request.execute()
                messages.extend(response.get('messages', []))
                request = service.users().messages().list_next(previous_request=request, previous_response=response)
                pages += 1
            
            if not messages:
                log_agent_activity("GMAIL_API", "No new emails found.")
                return
                
            processed_count = 0
            from app.services.agent_service import SYNC_HEARTBEATS
            import time
            for msg_meta in messages:
                if processed_count >= 500:
                    break
                    
                last_beat = SYNC_HEARTBEATS.get(user_id, 0)
                if time.time() - last_beat > 20:
                    log_agent_activity("GMAIL_API", "Sync stopped by user.")
                    break
                    
                msg_id = msg_meta['id']
                
                # Prevent duplicate ingestion or re-importing deleted emails
                deleted_email = db.query(models.DeletedEmail).filter(
                    models.DeletedEmail.message_id == msg_id,
                    models.DeletedEmail.user_id == user_id
                ).first()
                if deleted_email:
                    continue

                existing_email = db.query(models.Email).filter(
                    models.Email.message_id == msg_id,
                    models.Email.user_id == user_id
                ).first()
                if existing_email:
                    continue
                    
                msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
                processed_count += 1
                
                payload = msg.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = ""
                sender = ""
                message_id = msg_id
                
                internal_date_str = msg.get('internalDate')
                if internal_date_str:
                    received_at = datetime.datetime.utcfromtimestamp(int(internal_date_str) / 1000.0)
                else:
                    received_at = datetime.datetime.utcnow()
                
                for header in headers:
                    if header['name'].lower() == 'subject':
                        subject = header['value']
                    if header['name'].lower() == 'from':
                        sender = header['value']
                        
                def get_gmail_body(parts):
                    for part in parts:
                        if part['mimeType'] == 'text/plain':
                            data = part.get('body', {}).get('data', '')
                            if data:
                                data += "=" * ((4 - len(data) % 4) % 4)
                                return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                        elif 'parts' in part:
                            res = get_gmail_body(part['parts'])
                            if res: return res
                    # Fallback to html
                    for part in parts:
                        if part['mimeType'] == 'text/html':
                            data = part.get('body', {}).get('data', '')
                            if data:
                                data += "=" * ((4 - len(data) % 4) % 4)
                                html = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                                import re
                                return re.sub(r'<[^>]+>', ' ', html).strip()
                    return ""

                # Extract body
                body = ""
                parts = payload.get('parts', [])
                if not parts:
                    data = payload.get('body', {}).get('data', '')
                    if data:
                        data += "=" * ((4 - len(data) % 4) % 4)
                        body_raw = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                        if payload.get('mimeType') == 'text/html':
                            import re
                            body = re.sub(r'<[^>]+>', ' ', body_raw).strip()
                        else:
                            body = body_raw
                else:
                    body = get_gmail_body(parts)
                # FAST INSERT for real-time UI reflection
                db_email = models.Email(
                    user_id=user_id,
                    sender=sender,
                    recipient=user.email,
                    subject=subject,
                    body=body,
                    message_id=message_id,
                    received_at=received_at,
                    category="Unclassified",
                    priority="Medium",
                    summary="Summary generation pending...",
                    is_simulated=False,
                    is_read=False
                )
                db.add(db_email)
                db.commit()
                
            # AFTER FAST INSERT: Process all Unclassified emails with AI
            unclassified = db.query(models.Email).filter(
                models.Email.user_id == user_id,
                models.Email.category == "Unclassified",
                models.Email.is_simulated == False
            ).all()
            
            for e in unclassified:
                try:
                    AgentService.process_new_email(
                        db=db,
                        user_id=user_id,
                        sender=e.sender,
                        recipient=e.recipient,
                        subject=e.subject,
                        body=e.body,
                        message_id=e.message_id,
                        received_at=e.received_at,
                        existing_email_id=e.id
                    )
                    
                    from app.notifications import NotificationService
                    NotificationService.process_email_for_notification(db, e.id)
                except Exception as exc:
                    log_agent_activity("GMAIL_API_ERROR", f"Error classifying email {e.id}: {str(exc)}")
        except Exception as e:
            log_agent_activity("GMAIL_API_ERROR", f"Error during Gmail sync: {str(e)}")

    elif user.imap_server and user.imap_password_encrypted:
        # Use IMAP
        try:
            log_agent_activity("IMAP_SYNC", f"Connecting to IMAP server {user.imap_server}...")
            mail = imaplib.IMAP4_SSL(user.imap_server)
            password = security.decrypt_imap_password(user.imap_password_encrypted)
            mail.login(user.imap_username, password)
            mail.select("inbox")
            
            status, data = mail.search(None, "ALL")
            if status != "OK":
                log_agent_activity("IMAP_SYNC", "No emails found.")
                return
                
            mail_ids = data[0].split()
            # IMAP returns IDs in chronological order; we want the latest 500
            latest_mail_ids = mail_ids[-500:]
            latest_mail_ids.reverse() # Process newest first
            
            log_agent_activity("IMAP_SYNC", f"Fetching {len(latest_mail_ids)} recent email(s).")
            
            for mail_id in latest_mail_ids:
                # 1. Fetch only the Message-ID header first to save massive amounts of bandwidth
                status, header_data = mail.fetch(mail_id, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
                if status != "OK":
                    continue
                
                header_text = header_data[0][1].decode('utf-8', errors='ignore')
                msg_headers = email.message_from_string(header_text)
                message_id = msg_headers.get("Message-ID", "")
                
                # Check DB for duplicate Message-ID or deleted email before downloading full email
                if message_id:
                    deleted_email = db.query(models.DeletedEmail).filter(
                        models.DeletedEmail.message_id == message_id,
                        models.DeletedEmail.user_id == user_id
                    ).first()
                    if deleted_email:
                        continue

                    existing = db.query(models.Email).filter(
                        models.Email.message_id == message_id,
                        models.Email.user_id == user_id
                    ).first()
                    if existing:
                        continue
                
                # 2. It's a new email, fetch the full body
                status, data = mail.fetch(mail_id, "(RFC822)")
                if status != "OK":
                    continue
                    
                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                subject, encoding = decode_header(msg.get("Subject", ""))[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding or "utf-8", errors="ignore")
                    
                sender, encoding = decode_header(msg.get("From", ""))[0]
                if isinstance(sender, bytes):
                    sender = sender.decode(encoding or "utf-8", errors="ignore")
                    
                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            payload = part.get_payload(decode=True)
                            body = payload.decode(errors="ignore") if payload else ""
                            break
                    if not body:
                        for part in msg.walk():
                            if part.get_content_type() == "text/html":
                                payload = part.get_payload(decode=True)
                                html = payload.decode(errors="ignore") if payload else ""
                                import re
                                body = re.sub(r'<[^>]+>', ' ', html).strip()
                                break
                else:
                    payload = msg.get_payload(decode=True)
                    raw_body = payload.decode(errors="ignore") if payload else ""
                    if msg.get_content_type() == "text/html":
                        import re
                        body = re.sub(r'<[^>]+>', ' ', raw_body).strip()
                    else:
                        body = raw_body
                    
                date_header = msg.get("Date")
                received_at = datetime.datetime.utcnow()
                if date_header:
                    try:
                        received_at = parsedate_to_datetime(date_header)
                        if received_at.tzinfo:
                            received_at = received_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                    except:
                        pass
                        
                # FAST INSERT for real-time UI reflection
                db_email = models.Email(
                    user_id=user_id,
                    sender=sender,
                    recipient=user.email,
                    subject=subject,
                    body=body,
                    message_id=message_id,
                    received_at=received_at,
                    category="Unclassified",
                    priority="Medium",
                    summary="Summary generation pending...",
                    is_simulated=False,
                    is_read=False
                )
                db.add(db_email)
                db.commit()
                
            mail.close()
            mail.logout()
            
            # AFTER FAST INSERT: Process all Unclassified emails with AI
            unclassified = db.query(models.Email).filter(
                models.Email.user_id == user_id,
                models.Email.category == "Unclassified",
                models.Email.is_simulated == False
            ).all()
            
            for e in unclassified:
                try:
                    AgentService.process_new_email(
                        db=db,
                        user_id=user_id,
                        sender=e.sender,
                        recipient=e.recipient,
                        subject=e.subject,
                        body=e.body,
                        message_id=e.message_id,
                        received_at=e.received_at,
                        raw_headers=[],
                        existing_email_id=e.id
                    )
                    
                    from app.notifications import NotificationService
                    NotificationService.process_email_for_notification(db, e.id)
                except Exception as exc:
                    log_agent_activity("IMAP_SYNC_ERROR", f"Error classifying email {e.id}: {str(exc)}")
        except Exception as e:
            log_agent_activity("IMAP_SYNC_ERROR", f"Error during IMAP sync: {str(e)}")
    else:
        log_agent_activity("IMAP_SYNC", "No email credentials found for user. Cannot sync.")
