from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional, Any
import datetime

from app.api import deps
from app.db.session import get_db
from app.models import models

router = APIRouter()

@router.post("/")
async def create_scheduled_email(
    to: str = Form(...),
    cc: Optional[str] = Form(None),
    bcc: Optional[str] = Form(None),
    subject: str = Form(""),
    body: str = Form(""),
    scheduled_at: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    try:
        dt = datetime.datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format. Must be ISO 8601.")
        
    new_schedule = models.ScheduledEmail(
        user_id=current_user.id,
        to=to,
        cc=cc,
        bcc=bcc,
        subject=subject,
        body=body,
        scheduled_at=dt,
        status="pending"
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    return new_schedule

@router.get("/")
async def list_scheduled_emails(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    schedules = db.query(models.ScheduledEmail).filter(
        models.ScheduledEmail.user_id == current_user.id,
        models.ScheduledEmail.status == "pending"
    ).order_by(models.ScheduledEmail.scheduled_at).all()
    return schedules

@router.delete("/{schedule_id}")
async def cancel_scheduled_email(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    schedule = db.query(models.ScheduledEmail).filter(
        models.ScheduledEmail.id == schedule_id,
        models.ScheduledEmail.user_id == current_user.id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Scheduled email not found")
    
    schedule.status = "cancelled"
    db.commit()
    db.refresh(schedule)
    return {"status": "success", "message": "Scheduled email cancelled"}

@router.put("/{schedule_id}")
async def update_scheduled_email(
    schedule_id: int,
    scheduled_at: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    schedule = db.query(models.ScheduledEmail).filter(
        models.ScheduledEmail.id == schedule_id,
        models.ScheduledEmail.user_id == current_user.id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Scheduled email not found")
        
    try:
        dt = datetime.datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format. Must be ISO 8601.")
        
    schedule.scheduled_at = dt
    db.commit()
    db.refresh(schedule)
    return schedule
