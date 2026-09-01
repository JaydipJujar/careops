from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import asyncio
import resend
from apscheduler.schedulers.asyncio import AsyncIOScheduler
#from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend setup
resend.api_key = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Used to build links inside emails (public booking/contact/form-fill pages)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Reminder windows (hours) - how far ahead of a booking to send a reminder,
# and how long a form stays pending before we nudge the customer again.
BOOKING_REMINDER_HOURS_AHEAD = float(os.environ.get('BOOKING_REMINDER_HOURS_AHEAD', 24))
FORM_REMINDER_AFTER_HOURS = float(os.environ.get('FORM_REMINDER_AFTER_HOURS', 24))

# JWT setup
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

# ============= MODELS =============

class UserRole(str):
    OWNER = "owner"
    STAFF = "staff"

# Modules a staff member's access can be scoped to. Owners always have full access.
STAFF_PERMISSION_MODULES = ["inbox", "bookings", "forms", "inventory"]

def default_staff_permissions() -> Dict[str, bool]:
    return {module: True for module in STAFF_PERMISSION_MODULES}

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: str
    workspace_id: Optional[str] = None
    # Only meaningful for staff; owners are never restricted by this.
    permissions: Dict[str, bool] = Field(default_factory=default_staff_permissions)
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: str = "owner"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class StaffInvite(BaseModel):
    email: EmailStr
    password: str
    permissions: Optional[Dict[str, bool]] = None

class StaffPermissionsUpdate(BaseModel):
    permissions: Dict[str, bool]

class WorkspaceUpdate(BaseModel):
    business_name: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None
    contact_email: Optional[EmailStr] = None

class TokenResponse(BaseModel):
    token: str
    user: Dict[str, Any]

class Workspace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    workspace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    business_name: str
    address: Optional[str] = None
    timezone: str = "UTC"
    contact_email: EmailStr
    is_active: bool = False
    onboarding_step: int = 1
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WorkspaceCreate(BaseModel):
    business_name: str
    address: Optional[str] = None
    timezone: str = "UTC"
    contact_email: EmailStr

class IntegrationSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    settings_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    email_enabled: bool = False
    sms_enabled: bool = False
    email_config: Optional[Dict[str, Any]] = None
    sms_config: Optional[Dict[str, Any]] = None

class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    contact_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: str = "contact_form"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContactCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    message: Optional[str] = None

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_type: str
    content: str
    channel: str
    sent_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    conversation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    contact_id: str
    status: str = "active"
    last_message_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    automation_paused: bool = False

class ServiceType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    service_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    duration_minutes: int
    location: Optional[str] = None
    is_active: bool = True

class ServiceCreate(BaseModel):
    name: str
    duration_minutes: int
    location: Optional[str] = None

class Availability(BaseModel):
    model_config = ConfigDict(extra="ignore")
    availability_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    day_of_week: int
    start_time: str
    end_time: str

class AvailabilityCreate(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    contact_id: str
    service_id: str
    scheduled_at: str
    status: str = "confirmed"
    reminder_sent: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingCreate(BaseModel):
    service_id: str
    scheduled_at: str
    contact_name: str
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None

class BookingUpdate(BaseModel):
    status: str

class FormTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    form_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    description: Optional[str] = None
    fields: List[Dict[str, Any]]
    linked_service_ids: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FormCreate(BaseModel):
    name: str
    description: Optional[str] = None
    fields: List[Dict[str, Any]]
    linked_service_ids: List[str] = []

class FormSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    submission_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    form_id: str
    booking_id: Optional[str] = None
    contact_id: str
    data: Dict[str, Any] = {}
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_reminded_at: Optional[str] = None
    submitted_at: Optional[str] = None

class FormSubmissionSubmit(BaseModel):
    data: Dict[str, Any]

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    quantity: int
    low_stock_threshold: int
    unit: Optional[str] = None

class InventoryCreate(BaseModel):
    name: str
    quantity: int
    low_stock_threshold: int
    unit: Optional[str] = None

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    alert_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    type: str
    title: str
    message: str
    severity: str = "info"
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============= AUTH HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_permission(module: str):
    """
    Dependency factory: owners always pass. Staff must have the named module
    enabled in their permissions map. Use on routes that MODIFY workspace data
    (creating/editing bookings, replying to conversations, managing forms or
    inventory) - not on read-only routes, which stay open to any workspace user.
    """
    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] == "owner":
            return current_user
        if current_user["role"] == "staff":
            permissions = current_user.get("permissions") or {}
            if permissions.get(module, False):
                return current_user
        raise HTTPException(status_code=403, detail=f"You don't have access to {module}")
    return checker

async def require_owner(current_user: dict = Depends(get_current_user)):
    """Configuration, automation rules, and integrations are owner-only per spec."""
    if current_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the business owner can do this")
    return current_user

# ============= EMAIL HELPER =============

async def send_email_async(to_email: str, subject: str, html_content: str, workspace_id: Optional[str] = None):
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        if workspace_id:
            alert = Alert(
                workspace_id=workspace_id,
                type="integration_failure",
                title="Email delivery failed",
                message=f"Could not send email to {to_email}: {str(e)}",
                severity="critical"
            )
            await db.alerts.insert_one(alert.model_dump())
        return None

# ============= ROUTES =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role
    )
    await db.users.insert_one(user.model_dump())
    
    token = create_token(user.user_id, user.email, user.role)
    return {
        "token": token,
        "user": {"user_id": user.user_id, "email": user.email, "role": user.role}
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["user_id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {"user_id": user["user_id"], "email": user["email"], "role": user["role"], "workspace_id": user.get("workspace_id")}
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user_id": current_user["user_id"], "email": current_user["email"], "role": current_user["role"], "workspace_id": current_user.get("workspace_id")}

@api_router.post("/workspace", response_model=Workspace)
async def create_workspace(data: WorkspaceCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can create workspaces")
    
    workspace = Workspace(
        owner_id=current_user["user_id"],
        business_name=data.business_name,
        address=data.address,
        timezone=data.timezone,
        contact_email=data.contact_email
    )
    await db.workspaces.insert_one(workspace.model_dump())
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"workspace_id": workspace.workspace_id}}
    )
    return workspace

@api_router.get("/workspace")
async def get_workspace(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=404, detail="No workspace found")
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@api_router.put("/workspace/onboarding")
async def update_onboarding_step(step: int, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"onboarding_step": step}}
    )
    return {"status": "success"}

@api_router.put("/workspace")
async def update_workspace(data: WorkspaceUpdate, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.workspaces.update_one({"workspace_id": workspace_id}, {"$set": updates})
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    return workspace

@api_router.post("/workspace/activate")
async def activate_workspace(current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")

    # Spec: before activation, verify a communication channel is connected,
    # at least one booking type exists, and availability is defined.
    integrations = await db.integration_settings.find_one({"workspace_id": workspace_id}, {"_id": 0})
    has_channel = bool(integrations and (integrations.get("email_enabled") or integrations.get("sms_enabled")))
    service_count = await db.services.count_documents({"workspace_id": workspace_id, "is_active": True})
    availability_count = await db.availability.count_documents({"workspace_id": workspace_id})

    missing = []
    if not has_channel:
        missing.append("Connect at least one communication channel (email or SMS)")
    if service_count == 0:
        missing.append("Create at least one service/booking type")
    if availability_count == 0:
        missing.append("Define your availability")

    if missing:
        raise HTTPException(status_code=400, detail={"message": "Workspace is not ready to activate", "missing": missing})

    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"is_active": True}}
    )
    return {"status": "success"}

@api_router.post("/staff/invite")
async def invite_staff(data: StaffInvite, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Create a workspace before adding staff")

    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    permissions = data.permissions if data.permissions is not None else default_staff_permissions()
    staff = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="staff",
        workspace_id=workspace_id,
        permissions=permissions
    )
    await db.users.insert_one(staff.model_dump())

    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    business_name = workspace["business_name"] if workspace else "CareOps"
    await send_email_async(
        data.email,
        f"You've been invited to {business_name} on CareOps",
        f"<h2>Welcome to the team!</h2><p>You've been added as staff for <strong>{business_name}</strong>.</p>"
        f"<p>Sign in at <a href=\"{FRONTEND_URL}/auth\">{FRONTEND_URL}/auth</a> with the email and password your owner shared with you.</p>",
        workspace_id=workspace_id
    )

    return {"user_id": staff.user_id, "email": staff.email, "role": staff.role, "permissions": staff.permissions}

@api_router.get("/staff")
async def list_staff(current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    staff = await db.users.find(
        {"workspace_id": workspace_id, "role": "staff"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return staff

@api_router.put("/staff/{user_id}/permissions")
async def update_staff_permissions(user_id: str, data: StaffPermissionsUpdate, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    staff = await db.users.find_one({"user_id": user_id, "workspace_id": workspace_id, "role": "staff"}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    await db.users.update_one({"user_id": user_id}, {"$set": {"permissions": data.permissions}})
    return {"status": "success"}

@api_router.delete("/staff/{user_id}")
async def remove_staff(user_id: str, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    result = await db.users.delete_one({"user_id": user_id, "workspace_id": workspace_id, "role": "staff"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return {"status": "success"}

@api_router.post("/integrations")
async def setup_integrations(email_enabled: bool, sms_enabled: bool, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    settings = IntegrationSettings(
        workspace_id=workspace_id,
        email_enabled=email_enabled,
        sms_enabled=sms_enabled
    )
    await db.integration_settings.insert_one(settings.model_dump())
    return settings

@api_router.get("/integrations")
async def get_integrations(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    settings = await db.integration_settings.find_one({"workspace_id": workspace_id}, {"_id": 0})
    return settings or {"email_enabled": False, "sms_enabled": False}

@api_router.post("/contacts/public")
async def create_public_contact(workspace_id: str, data: ContactCreate):
    contact = Contact(
        workspace_id=workspace_id,
        name=data.name,
        email=data.email,
        phone=data.phone
    )
    await db.contacts.insert_one(contact.model_dump())
    
    conversation = Conversation(
        workspace_id=workspace_id,
        contact_id=contact.contact_id
    )
    await db.conversations.insert_one(conversation.model_dump())
    
    welcome_message = Message(
        conversation_id=conversation.conversation_id,
        sender_type="system",
        content=f"Hello {data.name}! Thank you for reaching out. We'll get back to you shortly.",
        channel="email"
    )
    await db.messages.insert_one(welcome_message.model_dump())
    
    if data.email:
        await send_email_async(
            data.email,
            "Welcome!",
            f"<h2>Hello {data.name}!</h2><p>Thank you for reaching out. We'll get back to you shortly.</p>",
            workspace_id=workspace_id
        )
    
    return {"status": "success", "contact_id": contact.contact_id}

@api_router.get("/contacts")
async def get_contacts(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    contacts = await db.contacts.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    return contacts

@api_router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    conversations = await db.conversations.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    for conv in conversations:
        contact = await db.contacts.find_one({"contact_id": conv["contact_id"]}, {"_id": 0})
        conv["contact"] = contact
    return conversations

@api_router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("sent_at", 1).to_list(1000)
    return messages

@api_router.post("/conversations/{conversation_id}/reply")
async def reply_to_conversation(conversation_id: str, content: str, current_user: dict = Depends(require_permission("inbox"))):
    message = Message(
        conversation_id=conversation_id,
        sender_type="staff",
        content=content,
        channel="email"
    )
    await db.messages.insert_one(message.model_dump())
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"automation_paused": True, "last_message_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success"}

@api_router.post("/services", response_model=ServiceType)
async def create_service(data: ServiceCreate, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    service = ServiceType(
        workspace_id=workspace_id,
        name=data.name,
        duration_minutes=data.duration_minutes,
        location=data.location
    )
    await db.services.insert_one(service.model_dump())
    return service

@api_router.get("/services")
async def get_services(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    ws_id = workspace_id or current_user.get("workspace_id")
    services = await db.services.find({"workspace_id": ws_id, "is_active": True}, {"_id": 0}).to_list(1000)
    return services

@api_router.post("/availability", response_model=Availability)
async def create_availability(data: AvailabilityCreate, current_user: dict = Depends(require_owner)):
    workspace_id = current_user.get("workspace_id")
    availability = Availability(
        workspace_id=workspace_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time
    )
    await db.availability.insert_one(availability.model_dump())
    return availability

@api_router.get("/availability")
async def get_availability(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    ws_id = workspace_id or current_user.get("workspace_id")
    availability = await db.availability.find({"workspace_id": ws_id}, {"_id": 0}).to_list(1000)
    return availability

async def send_linked_forms_for_booking(workspace_id: str, booking: "Booking", contact: "Contact"):
    """
    Step 5 of the spec: when a booking is created for a service, any form
    templates linked to that service are sent to the customer automatically.
    Creates a pending FormSubmission per linked form and emails the fill-in link.
    """
    forms = await db.forms.find(
        {"workspace_id": workspace_id, "linked_service_ids": booking.service_id},
        {"_id": 0}
    ).to_list(1000)

    for form in forms:
        submission = FormSubmission(
            workspace_id=workspace_id,
            form_id=form["form_id"],
            booking_id=booking.booking_id,
            contact_id=contact.contact_id
        )
        await db.form_submissions.insert_one(submission.model_dump())

        if contact.email:
            fill_link = f"{FRONTEND_URL}/public/forms/{submission.submission_id}"
            await send_email_async(
                contact.email,
                f"Please complete: {form['name']}",
                f"<h2>One more step</h2><p>Please fill out <strong>{form['name']}</strong> before your appointment:</p>"
                f"<p><a href=\"{fill_link}\">{fill_link}</a></p>",
                workspace_id=workspace_id
            )

@api_router.post("/bookings/public")
async def create_public_booking(workspace_id: str, data: BookingCreate):
    contact = Contact(
        workspace_id=workspace_id,
        name=data.contact_name,
        email=data.contact_email,
        phone=data.contact_phone,
        source="booking"
    )
    await db.contacts.insert_one(contact.model_dump())
    
    booking = Booking(
        workspace_id=workspace_id,
        contact_id=contact.contact_id,
        service_id=data.service_id,
        scheduled_at=data.scheduled_at
    )
    await db.bookings.insert_one(booking.model_dump())
    
    if data.contact_email:
        await send_email_async(
            data.contact_email,
            "Booking Confirmed",
            f"<h2>Booking Confirmed!</h2><p>Your booking for {data.scheduled_at} has been confirmed.</p>",
            workspace_id=workspace_id
        )

    await send_linked_forms_for_booking(workspace_id, booking, contact)
    
    return {"status": "success", "booking_id": booking.booking_id}

@api_router.get("/bookings")
async def get_bookings(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    bookings = await db.bookings.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    for booking in bookings:
        contact = await db.contacts.find_one({"contact_id": booking["contact_id"]}, {"_id": 0})
        service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
        booking["contact"] = contact
        booking["service"] = service
    return bookings

@api_router.put("/bookings/{booking_id}")
async def update_booking(booking_id: str, data: BookingUpdate, current_user: dict = Depends(require_permission("bookings"))):
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": data.status}}
    )
    return {"status": "success"}

@api_router.post("/forms", response_model=FormTemplate)
async def create_form(data: FormCreate, current_user: dict = Depends(require_permission("forms"))):
    workspace_id = current_user.get("workspace_id")
    form = FormTemplate(
        workspace_id=workspace_id,
        name=data.name,
        description=data.description,
        fields=data.fields,
        linked_service_ids=data.linked_service_ids
    )
    await db.forms.insert_one(form.model_dump())
    return form

@api_router.get("/forms")
async def get_forms(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    forms = await db.forms.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    return forms

@api_router.get("/forms/submissions")
async def get_form_submissions(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    submissions = await db.form_submissions.find({"workspace_id": workspace_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for sub in submissions:
        form = await db.forms.find_one({"form_id": sub["form_id"]}, {"_id": 0})
        contact = await db.contacts.find_one({"contact_id": sub["contact_id"]}, {"_id": 0})
        sub["form"] = form
        sub["contact"] = contact
    return submissions

# ----- Public, no-auth form fill-in flow (customer side, Step 5 of onboarding) -----

@api_router.get("/forms/public/{submission_id}")
async def get_public_form_submission(submission_id: str):
    submission = await db.form_submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Form link not found")
    form = await db.forms.find_one({"form_id": submission["form_id"]}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"submission": submission, "form": form}

@api_router.post("/forms/public/{submission_id}/submit")
async def submit_public_form(submission_id: str, data: FormSubmissionSubmit):
    submission = await db.form_submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Form link not found")
    if submission["status"] == "completed":
        raise HTTPException(status_code=400, detail="This form was already submitted")

    await db.form_submissions.update_one(
        {"submission_id": submission_id},
        {"$set": {
            "data": data.data,
            "status": "completed",
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"status": "success"}

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory(data: InventoryCreate, current_user: dict = Depends(require_permission("inventory"))):
    workspace_id = current_user.get("workspace_id")
    item = InventoryItem(
        workspace_id=workspace_id,
        name=data.name,
        quantity=data.quantity,
        low_stock_threshold=data.low_stock_threshold,
        unit=data.unit
    )
    await db.inventory.insert_one(item.model_dump())
    
    if item.quantity <= item.low_stock_threshold:
        alert = Alert(
            workspace_id=workspace_id,
            type="inventory",
            title="Low Stock Alert",
            message=f"{item.name} is running low (current: {item.quantity})",
            severity="warning"
        )
        await db.alerts.insert_one(alert.model_dump())
    
    return item

@api_router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    items = await db.inventory.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(1000)
    return items

@api_router.put("/inventory/{item_id}")
async def update_inventory(item_id: str, quantity: int, current_user: dict = Depends(require_permission("inventory"))):
    workspace_id = current_user.get("workspace_id")
    await db.inventory.update_one(
        {"item_id": item_id},
        {"$set": {"quantity": quantity}}
    )
    
    item = await db.inventory.find_one({"item_id": item_id}, {"_id": 0})
    if item and item["quantity"] <= item["low_stock_threshold"]:
        alert = Alert(
            workspace_id=workspace_id,
            type="inventory",
            title="Low Stock Alert",
            message=f"{item['name']} is running low (current: {item['quantity']})",
            severity="warning"
        )
        await db.alerts.insert_one(alert.model_dump())
    
    return {"status": "success"}

@api_router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    alerts = await db.alerts.find({"workspace_id": workspace_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return alerts

@api_router.put("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, current_user: dict = Depends(get_current_user)):
    await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"is_read": True}}
    )
    return {"status": "success"}

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    total_bookings = await db.bookings.count_documents({"workspace_id": workspace_id})
    today_bookings = await db.bookings.count_documents({
        "workspace_id": workspace_id,
        "scheduled_at": {"$regex": f"^{today}"}
    })
    
    total_contacts = await db.contacts.count_documents({"workspace_id": workspace_id})
    unread_conversations = await db.conversations.count_documents({
        "workspace_id": workspace_id,
        "automation_paused": False
    })
    
    pending_forms = await db.form_submissions.count_documents({"status": "pending"})
    
    low_stock_items = await db.inventory.find({
        "workspace_id": workspace_id,
        "$expr": {"$lte": ["$quantity", "$low_stock_threshold"]}
    }, {"_id": 0}).to_list(1000)
    
    unread_alerts = await db.alerts.count_documents({
        "workspace_id": workspace_id,
        "is_read": False
    })
    
    return {
        "bookings": {
            "total": total_bookings,
            "today": today_bookings
        },
        "contacts": {
            "total": total_contacts,
            "unread_conversations": unread_conversations
        },
        "forms": {
            "pending": pending_forms
        },
        "inventory": {
            "low_stock_count": len(low_stock_items),
            "low_stock_items": low_stock_items
        },
        "alerts": {
            "unread": unread_alerts
        }
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# ============= AUTOMATION: SCHEDULED REMINDERS =============
# Event-based automation is handled inline at creation time (welcome message,
# booking confirmation, inventory alerts). These two jobs cover the two rules
# from the spec that are time-based rather than event-based: a reminder before
# an upcoming booking, and a nudge for a form that's still pending.

async def send_booking_reminders():
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=BOOKING_REMINDER_HOURS_AHEAD)
    upcoming = await db.bookings.find({
        "status": "confirmed",
        "reminder_sent": False
    }, {"_id": 0}).to_list(1000)

    for booking in upcoming:
        try:
            scheduled_at = datetime.fromisoformat(booking["scheduled_at"])
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        except (ValueError, KeyError):
            continue

        if now < scheduled_at <= window_end:
            contact = await db.contacts.find_one({"contact_id": booking["contact_id"]}, {"_id": 0})
            if contact and contact.get("email"):
                await send_email_async(
                    contact["email"],
                    "Reminder: Upcoming appointment",
                    f"<h2>See you soon!</h2><p>This is a reminder of your appointment on {booking['scheduled_at']}.</p>",
                    workspace_id=booking["workspace_id"]
                )
            await db.bookings.update_one(
                {"booking_id": booking["booking_id"]},
                {"$set": {"reminder_sent": True}}
            )

async def send_pending_form_reminders():
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=FORM_REMINDER_AFTER_HOURS)
    pending = await db.form_submissions.find({"status": "pending"}, {"_id": 0}).to_list(1000)

    for submission in pending:
        created_at = datetime.fromisoformat(submission["created_at"])
        last_reminded = submission.get("last_reminded_at")
        last_reminded_at = datetime.fromisoformat(last_reminded) if last_reminded else None

        due_for_reminder = created_at <= cutoff and (last_reminded_at is None or last_reminded_at <= cutoff)
        if not due_for_reminder:
            continue

        contact = await db.contacts.find_one({"contact_id": submission["contact_id"]}, {"_id": 0})
        form = await db.forms.find_one({"form_id": submission["form_id"]}, {"_id": 0})
        if contact and contact.get("email") and form:
            fill_link = f"{FRONTEND_URL}/public/forms/{submission['submission_id']}"
            await send_email_async(
                contact["email"],
                f"Reminder: please complete {form['name']}",
                f"<h2>Still pending</h2><p>We're still waiting on <strong>{form['name']}</strong>.</p>"
                f"<p><a href=\"{fill_link}\">{fill_link}</a></p>",
                workspace_id=submission["workspace_id"]
            )
        await db.form_submissions.update_one(
            {"submission_id": submission["submission_id"]},
            {"$set": {"last_reminded_at": now.isoformat()}}
        )

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(send_booking_reminders, "interval", minutes=15, id="booking_reminders")
    scheduler.add_job(send_pending_form_reminders, "interval", minutes=60, id="form_reminders")
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()