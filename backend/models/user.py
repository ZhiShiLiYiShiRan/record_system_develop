from pydantic import BaseModel
from typing import Optional
class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None