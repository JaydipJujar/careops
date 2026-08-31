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

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: str
    workspace_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: str = "owner"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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

class FormSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    submission_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    form_id: str
    booking_id: Optional[str] = None
    contact_id: str
    data: Dict[str, Any]
    status: str = "pending"
    submitted_at: Optional[str] = None

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

# ============= EMAIL HELPER =============

async def send_email_async(to_email: str, subject: str, html_content: str):
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
async def update_onboarding_step(step: int, current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"onboarding_step": step}}
    )
    return {"status": "success"}

@api_router.post("/workspace/activate")
async def activate_workspace(current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"is_active": True}}
    )
    return {"status": "success"}

@api_router.post("/integrations")
async def setup_integrations(email_enabled: bool, sms_enabled: bool, current_user: dict = Depends(get_current_user)):
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
            f"<h2>Hello {data.name}!</h2><p>Thank you for reaching out. We'll get back to you shortly.</p>"
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
async def reply_to_conversation(conversation_id: str, content: str, current_user: dict = Depends(get_current_user)):
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
async def create_service(data: ServiceCreate, current_user: dict = Depends(get_current_user)):
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
async def create_availability(data: AvailabilityCreate, current_user: dict = Depends(get_current_user)):
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
            f"<h2>Booking Confirmed!</h2><p>Your booking for {data.scheduled_at} has been confirmed.</p>"
        )
    
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
async def update_booking(booking_id: str, data: BookingUpdate, current_user: dict = Depends(get_current_user)):
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": data.status}}
    )
    return {"status": "success"}

@api_router.post("/forms")
async def create_form(name: str, description: str, fields: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    workspace_id = current_user.get("workspace_id")
    form = FormTemplate(
        workspace_id=workspace_id,
        name=name,
        description=description,
        fields=fields
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
    submissions = await db.form_submissions.find({}, {"_id": 0}).to_list(1000)
    return submissions

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory(data: InventoryCreate, current_user: dict = Depends(get_current_user)):
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
async def update_inventory(item_id: str, quantity: int, current_user: dict = Depends(get_current_user)):
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()