from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Any
import datetime
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from app.api import deps
from app.db.session import get_db
from app.models import models
from app.schemas import schemas
from app.services.agent_service import log_agent_activity
from app.core import security
from app.core.config import settings
from google import genai
import httpx
from app.core import security
from app.services.llm_service import LLMService

router = APIRouter()

# In-memory drafts for simplicity, or we could add a DB model. To strictly not disturb existing, we can just use a simple DB model or directly interact with Gmail API. 
# We'll add a simple Draft model later if needed, but for now we'll support direct Send and basic Draft API.

import asyncio

@router.post("/send")
async def send_email(
    to: str = Form(...),
    cc: Optional[str] = Form(None),
    bcc: Optional[str] = Form(None),
    subject: str = Form(""),
    body: str = Form(""),
    files: List[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Send an email via Gmail API or SMTP.
    """
    msg = MIMEMultipart()
    msg['From'] = current_user.email
    msg['To'] = to
    if cc:
        msg['Cc'] = cc
    if subject:
        msg['Subject'] = subject
        
    msg.attach(MIMEText(body, 'html'))
    
    if files:
        for file in files:
            content = await file.read()
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(content)
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {file.filename}'
            )
            msg.attach(part)
            
    all_recipients = to.split(",") + (cc.split(",") if cc else []) + (bcc.split(",") if bcc else [])
    all_recipients = [r.strip() for r in all_recipients if r.strip()]

    if not current_user.google_access_token and not current_user.imap_server:
        raise HTTPException(status_code=400, detail="No email account connected. Please connect Gmail or IMAP.")

    asyncio.create_task(_process_send_email(current_user.email, current_user.google_access_token, current_user.imap_server, current_user.imap_password_encrypted, current_user.imap_username, to, all_recipients, msg.as_bytes()))
    return {"status": "success", "message": "Email is sending in the background...", "reset": True}

async def _process_send_email(user_email, google_access_token, imap_server, imap_password_encrypted, imap_username, to, all_recipients, msg_bytes):
    try:
        import email
        import smtplib
        msg = email.message_from_bytes(msg_bytes)
        email_sent = False
        api_error_message = None

        if google_access_token:
            try:
                raw_msg = base64.urlsafe_b64encode(msg_bytes).decode('utf-8')
                body_payload = {'raw': raw_msg}
                
                headers = {
                    'Authorization': f'Bearer {google_access_token}',
                    'Content-Type': 'application/json'
                }
                
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                        headers=headers,
                        json=body_payload,
                        timeout=30.0
                    )
                
                if resp.status_code == 200:
                    email_sent = True
                    log_agent_activity("COMPOSE_SEND", f"Successfully dispatched email to {to} via Gmail API")
                else:
                    api_error_message = f"Gmail API returned {resp.status_code}: {resp.text}"
                    log_agent_activity("COMPOSE_ERROR", api_error_message)
            except Exception as e:
                api_error_message = str(e)
                log_agent_activity("COMPOSE_ERROR", f"Exception: {str(e)}")
                
        if not email_sent and imap_server and imap_password_encrypted:
            try:
                smtp_server = imap_server.replace("imap.", "smtp.") if "imap." in imap_server else imap_server
                password = security.decrypt_imap_password(imap_password_encrypted)
                
                with smtplib.SMTP(smtp_server, 587) as server:
                    server.starttls()
                    server.login(imap_username, password)
                    server.send_message(msg, from_addr=user_email, to_addrs=all_recipients)
                    
                email_sent = True

            except Exception as e:
                api_error_message = str(e)
                log_agent_activity("COMPOSE_ERROR", f"SMTP Exception: {str(e)}")
    except Exception as e:
        log_agent_activity("COMPOSE_ERROR", f"Process Send Exception: {str(e)}")

@router.post("/draft")
async def save_draft(
    to: str = Form(""),
    subject: str = Form(""),
    body: str = Form(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Save draft via Gmail API if available.
    """
    if not current_user.google_access_token:
        return {"status": "success", "message": "Draft saved locally on client"}
        
    msg = MIMEMultipart()
    msg['From'] = current_user.email
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    
    asyncio.create_task(_process_save_draft(current_user.google_access_token, msg.as_bytes()))
    return {"status": "success", "draft_id": "draft_in_progress"}

async def _process_save_draft(google_access_token, msg_bytes):
    try:
        raw_msg = base64.urlsafe_b64encode(msg_bytes).decode('utf-8')
        body_payload = {'message': {'raw': raw_msg}}
        
        headers = {
            'Authorization': f'Bearer {google_access_token}',
            'Content-Type': 'application/json'
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
                headers=headers,
                json=body_payload,
                timeout=30.0
            )
        
        if resp.status_code == 200:
            log_agent_activity("COMPOSE_DRAFT", f"Draft saved successfully with ID {resp.json().get('id')}")
        else:
            log_agent_activity("COMPOSE_DRAFT_ERROR", f"Error saving draft: {resp.text}")
    except Exception as e:
        log_agent_activity("COMPOSE_DRAFT_ERROR", str(e))

@router.post("/rewrite")
async def rewrite_email(
    body: str = Form(""),
    tone: str = Form("Professional"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Rewrite email body using Gemini API.
    """
    if not body:
        raise HTTPException(status_code=400, detail="Body is empty")
    
    try:
        prompt = f"Rewrite the following email draft to sound more {tone.lower()} and polished, fixing any grammar mistakes. Return ONLY the new rewritten text with no markdown, quotes, or prefix.\n\nOriginal Text:\n{body}"
        system_prompt = "You are a professional email assistant. Rewrite the user's email drafts to be polished and professional."
        rewritten = LLMService._call_gemini(prompt, system_prompt)
        
        if not rewritten:
             return {"status": "success", "rewritten_text": body}
             
        return {"status": "success", "rewritten_text": rewritten.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Rewrite failed: {str(e)}")
