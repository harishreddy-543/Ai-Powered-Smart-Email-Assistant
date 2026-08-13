from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.db.session import get_db
from app.models import models

router = APIRouter()

@router.get("/")
async def list_linked_accounts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    accounts = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == current_user.id
    ).all()
    return accounts

@router.post("/switch/{account_id}")
async def switch_active_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    target_account = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.id == account_id,
        models.LinkedAccount.user_id == current_user.id
    ).first()
    
    if not target_account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    # Deactivate all
    db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == current_user.id
    ).update({"is_active": False})
    
    # Activate target
    target_account.is_active = True
    db.commit()
    
    return {"status": "success", "message": "Active account switched", "active_account_id": account_id}

@router.delete("/{account_id}")
async def remove_linked_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    account = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.id == account_id,
        models.LinkedAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    db.delete(account)
    db.commit()
    
    return {"status": "success", "message": "Account removed"}

@router.get("/active")
async def get_active_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    account = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == current_user.id,
        models.LinkedAccount.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="No active account found")
        
    return account
