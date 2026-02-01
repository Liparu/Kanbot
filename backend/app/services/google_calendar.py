import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
import httpx
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import settings

SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleCalendarService:
    def __init__(self):
        self.client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [],
            }
        }
    
    @property
    def is_configured(self) -> bool:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    
    def create_auth_url(self, redirect_uri: str, state: str) -> str:
        if not self.is_configured:
            raise ValueError("Google Calendar is not configured")
        
        self.client_config["web"]["redirect_uris"] = [redirect_uri]
        
        flow = Flow.from_client_config(
            self.client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent',
        )
        
        return auth_url
    
    def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        if not self.is_configured:
            raise ValueError("Google Calendar is not configured")
        
        self.client_config["web"]["redirect_uris"] = [redirect_uri]
        
        flow = Flow.from_client_config(
            self.client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        return {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else SCOPES,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        }
    
    def get_credentials(self, token_data: Dict[str, Any]) -> Optional[Credentials]:
        if not token_data:
            return None
        
        expiry = None
        if token_data.get("expiry"):
            expiry = datetime.fromisoformat(token_data["expiry"])
        
        credentials = Credentials(
            token=token_data.get("token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id", settings.GOOGLE_CLIENT_ID),
            client_secret=token_data.get("client_secret", settings.GOOGLE_CLIENT_SECRET),
            scopes=token_data.get("scopes", SCOPES),
            expiry=expiry,
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        
        return credentials
    
    def get_calendars(self, token_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        credentials = self.get_credentials(token_data)
        if not credentials:
            return []
        
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        
        return [
            {
                "id": cal.get("id"),
                "summary": cal.get("summary"),
                "primary": cal.get("primary", False),
                "background_color": cal.get("backgroundColor"),
            }
            for cal in calendar_list.get("items", [])
        ]
    
    def get_events(
        self,
        token_data: Dict[str, Any],
        calendar_id: str = 'primary',
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        sync_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        credentials = self.get_credentials(token_data)
        if not credentials:
            return {"items": [], "next_sync_token": None}
        
        service = build('calendar', 'v3', credentials=credentials)
        
        params = {
            "calendarId": calendar_id,
            "singleEvents": True,
            "orderBy": "startTime",
            "maxResults": 2500,
        }
        
        if sync_token:
            params["syncToken"] = sync_token
        else:
            if time_min:
                params["timeMin"] = time_min.isoformat() + 'Z'
            if time_max:
                params["timeMax"] = time_max.isoformat() + 'Z'
        
        try:
            events = service.events().list(**params).execute()
        except Exception as e:
            if "Sync token is no longer valid" in str(e):
                del params["syncToken"]
                if not time_min:
                    params["timeMin"] = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat().replace('+00:00', 'Z')
                events = service.events().list(**params).execute()
            else:
                raise
        
        return {
            "items": [
                {
                    "id": event.get("id"),
                    "summary": event.get("summary", ""),
                    "description": event.get("description"),
                    "start": event.get("start", {}).get("dateTime") or event.get("start", {}).get("date"),
                    "end": event.get("end", {}).get("dateTime") or event.get("end", {}).get("date"),
                    "location": event.get("location"),
                    "status": event.get("status"),
                    "html_link": event.get("htmlLink"),
                }
                for event in events.get("items", [])
                if event.get("status") != "cancelled"
            ],
            "next_sync_token": events.get("nextSyncToken"),
        }
    
    def create_event(
        self,
        token_data: Dict[str, Any],
        calendar_id: str,
        summary: str,
        start: datetime,
        end: Optional[datetime] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        all_day: bool = False,
    ) -> Dict[str, Any]:
        credentials = self.get_credentials(token_data)
        if not credentials:
            raise ValueError("Invalid credentials")
        
        service = build('calendar', 'v3', credentials=credentials)
        
        event = {
            "summary": summary,
        }
        
        if description:
            event["description"] = description
        if location:
            event["location"] = location
        
        if all_day:
            event["start"] = {"date": start.strftime("%Y-%m-%d")}
            event["end"] = {"date": (end or start).strftime("%Y-%m-%d")}
        else:
            event["start"] = {"dateTime": start.isoformat(), "timeZone": "UTC"}
            event["end"] = {"dateTime": (end or start + timedelta(hours=1)).isoformat(), "timeZone": "UTC"}
        
        created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
        
        return {
            "id": created_event.get("id"),
            "summary": created_event.get("summary"),
            "html_link": created_event.get("htmlLink"),
        }
    
    def update_event(
        self,
        token_data: Dict[str, Any],
        calendar_id: str,
        event_id: str,
        summary: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        all_day: bool = False,
    ) -> Dict[str, Any]:
        credentials = self.get_credentials(token_data)
        if not credentials:
            raise ValueError("Invalid credentials")
        
        service = build('calendar', 'v3', credentials=credentials)
        
        existing = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        
        if summary is not None:
            existing["summary"] = summary
        if description is not None:
            existing["description"] = description
        if location is not None:
            existing["location"] = location
        
        if start is not None:
            if all_day:
                existing["start"] = {"date": start.strftime("%Y-%m-%d")}
            else:
                existing["start"] = {"dateTime": start.isoformat(), "timeZone": "UTC"}
        
        if end is not None:
            if all_day:
                existing["end"] = {"date": end.strftime("%Y-%m-%d")}
            else:
                existing["end"] = {"dateTime": end.isoformat(), "timeZone": "UTC"}
        
        updated = service.events().update(calendarId=calendar_id, eventId=event_id, body=existing).execute()
        
        return {
            "id": updated.get("id"),
            "summary": updated.get("summary"),
        }
    
    def delete_event(
        self,
        token_data: Dict[str, Any],
        calendar_id: str,
        event_id: str,
    ) -> bool:
        credentials = self.get_credentials(token_data)
        if not credentials:
            raise ValueError("Invalid credentials")
        
        service = build('calendar', 'v3', credentials=credentials)
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        
        return True


google_calendar_service = GoogleCalendarService()
