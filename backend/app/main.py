# AI-Powered Email Assistant - Main Application Entry
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine, Base, SessionLocal
from app.api import auth, emails

import asyncio
import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.models import models
from app.api.compose import _process_send_email

# Automatically create SQLAlchemy tables on startup
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Database table initialization failed: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS Middleware for React Integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(emails.router, prefix=f"{settings.API_V1_STR}/emails", tags=["Emails"])

from app.api import compose
app.include_router(compose.router, prefix=f"{settings.API_V1_STR}/compose", tags=["Compose"])

from app.api import schedule
app.include_router(schedule.router, prefix=f"{settings.API_V1_STR}/schedule", tags=["Schedule"])

from app.api import accounts
app.include_router(accounts.router, prefix=f"{settings.API_V1_STR}/accounts", tags=["Accounts"])

@app.on_event('startup')
async def startup_event():
    async def scheduler_task():
        while True:
            db = SessionLocal()
            try:
                now = datetime.datetime.utcnow()
                pending_emails = db.query(models.ScheduledEmail).filter(
                    models.ScheduledEmail.status == 'pending',
                    models.ScheduledEmail.scheduled_at <= now
                ).all()
                
                for email_task in pending_emails:
                    user = db.query(models.User).filter(models.User.id == email_task.user_id).first()
                    if user:
                        msg = MIMEMultipart()
                        msg['From'] = user.email
                        msg['To'] = email_task.to
                        if email_task.cc:
                            msg['Cc'] = email_task.cc
                        if email_task.subject:
                            msg['Subject'] = email_task.subject
                            
                        msg.attach(MIMEText(email_task.body, 'html'))
                        
                        all_recipients = email_task.to.split(",") + (email_task.cc.split(",") if email_task.cc else []) + (email_task.bcc.split(",") if email_task.bcc else [])
                        all_recipients = [r.strip() for r in all_recipients if r.strip()]

                        await _process_send_email(
                            user.email, user.google_access_token, user.imap_server,
                            user.imap_password_encrypted, user.imap_username,
                            email_task.to, all_recipients, msg.as_bytes()
                        )
                        email_task.status = 'sent'
                        db.commit()
            except Exception as e:
                print(f"Scheduler error: {e}")
            finally:
                db.close()
            
            await asyncio.sleep(60)

    asyncio.create_task(scheduler_task())

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the AI-Powered Intelligent Email Assistant API",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
