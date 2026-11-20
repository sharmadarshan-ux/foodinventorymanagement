"""
Auth Router — Department-based login for scoped access.
Lightweight auth for hackathon: plaintext password check, no JWT.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class DepartmentLoginRequest(BaseModel):
    dept_code: str = Field(..., description="Department code, e.g. SNACKS")
    password: str = Field(..., description="Department password")


class DepartmentLoginResponse(BaseModel):
    dept_code: str
    name: str
    icon: str
    message: str


@router.get(
    "/departments",
    summary="List all departments",
    description="Returns department names and codes (no passwords) for the login dropdown.",
)
async def list_departments():
    try:
        sb = get_supabase()
        resp = (
            sb.table("departments")
            .select("id, dept_code, name, icon")
            .order("name")
            .execute()
        )
        return resp.data or []

    except Exception as e:
        logger.error("List departments error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list departments: {e}")


@router.post(
    "/department-login",
    summary="Department staff login",
    description=(
        "Validates department credentials. Returns department info on success. "
        "Frontend stores this in localStorage for scoped session."
    ),
)
async def department_login(body: DepartmentLoginRequest):
    try:
        sb = get_supabase()
        resp = (
            sb.table("departments")
            .select("*")
            .eq("dept_code", body.dept_code.upper())
            .execute()
        )

        if not resp.data:
            raise HTTPException(status_code=401, detail="Department not found.")

        dept = resp.data[0]

        if dept["password"] != body.password:
            raise HTTPException(status_code=401, detail="Invalid password.")

        return DepartmentLoginResponse(
            dept_code=dept["dept_code"],
            name=dept["name"],
            icon=dept.get("icon", "📦"),
            message=f"Welcome, {dept['name']} department!",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Department login error: %s", e)
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")
