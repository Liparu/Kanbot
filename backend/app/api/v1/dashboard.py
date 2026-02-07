from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import os
import json

from app.core.database import get_db
from app.models.user import User
from app.models.card import Card, CardHistory
from app.models.space import Space
from app.api.deps import get_current_admin

router = APIRouter()


class AgentStatus(BaseModel):
    name: str
    status: str  # active, idle, error, offline
    last_seen: Optional[str] = None
    current_task: Optional[str] = None
    space_id: Optional[str] = None


class CronJobStatus(BaseModel):
    name: str
    status: str  # running, success, failed, unknown
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    schedule: str


class RecentTask(BaseModel):
    id: str
    action: str
    actor_name: str
    actor_type: str
    created_at: str
    card_name: Optional[str] = None
    space_name: Optional[str] = None


class SystemError(BaseModel):
    timestamp: str
    source: str
    message: str
    severity: str  # info, warning, error, critical


class DashboardStats(BaseModel):
    agents: List[AgentStatus]
    cron_jobs: List[CronJobStatus]
    recent_tasks: List[RecentTask]
    errors: List[SystemError]
    system_health: dict


def get_cron_status() -> List[CronJobStatus]:
    """Read cron job status - returns actual Qratos schedule"""
    cron_jobs = []
    
    # Actual Qratos cron schedule (updated 2026-02-07)
    cron_configs = [
        # Sub-agents
        {"name": "🔭 Sentinel Patrol", "schedule": "*/15 * * * *"},
        {"name": "📣 Marketer Daily", "schedule": "0 18 * * *"},
        # Daytime recurring
        {"name": "💻 Hourly Coder", "schedule": "0,30 6-23 * * *"},
        {"name": "⏰ Delegation Check", "schedule": "0,30 6-23 * * *"},
        # Daily jobs
        {"name": "☀️ Morning Briefing", "schedule": "0 6 * * *"},
        {"name": "📅 Morning Calendar", "schedule": "30 6 * * *"},
        {"name": "📋 Morning Activity", "schedule": "0 7 * * *"},
        {"name": "📁 NAS Pipeline", "schedule": "0 7,19 * * *"},
        {"name": "⚡ Friction Check", "schedule": "0 14 * * *"},
        {"name": "🎯 Qratos Proactive", "schedule": "0 15 * * *"},
        {"name": "📋 Meeting Prep", "schedule": "0 20 * * *"},
        {"name": "📊 Evening Digest", "schedule": "0 20 * * *"},
        {"name": "🧠 Evening Ideation", "schedule": "30 21 * * *"},
        {"name": "🗓️ Memory Summary", "schedule": "0 22 * * *"},
        # Nightly jobs
        {"name": "🔍 Moltbook Intel", "schedule": "0 0 * * *"},
        {"name": "🌙 Night Coder", "schedule": "0,20,40 0-5 * * *"},
        {"name": "🔍 Discovery Hunt", "schedule": "0 1 * * *"},
        {"name": "🔍 GitHub Scout", "schedule": "0 2 * * *"},
        {"name": "👁️ Code Review", "schedule": "45 2 * * *"},
        {"name": "📚 KB Reindex", "schedule": "0 3 * * *"},
        {"name": "💾 Daily Backup", "schedule": "0 4 * * *"},
    ]
    
    now = datetime.now(timezone.utc)
    
    for config in cron_configs:
        # Calculate next run time based on cron schedule
        next_run = calculate_next_cron_run(config["schedule"], now)
        
        cron_jobs.append(CronJobStatus(
            name=config["name"],
            status="pending",  # Will be enhanced later with real status
            last_run=None,
            next_run=next_run.isoformat() if next_run else None,
            schedule=config["schedule"]
        ))
    
    # Sort by next run time
    cron_jobs.sort(key=lambda j: j.next_run or "9999")
    
    return cron_jobs


def calculate_next_cron_run(schedule: str, now: datetime) -> Optional[datetime]:
    """Simple cron schedule parser - returns next run time today"""
    try:
        parts = schedule.split()
        if len(parts) < 5:
            return None
        
        minute, hour, *_ = parts
        
        # Handle simple cases
        if hour == "*":
            # Runs every hour at specified minute(s)
            if minute.startswith("*/"):
                interval = int(minute[2:])
                next_min = ((now.minute // interval) + 1) * interval
                if next_min >= 60:
                    return now.replace(hour=now.hour + 1, minute=0, second=0, microsecond=0)
                return now.replace(minute=next_min, second=0, microsecond=0)
            elif "," in minute:
                mins = [int(m) for m in minute.split(",")]
                for m in mins:
                    if m > now.minute:
                        return now.replace(minute=m, second=0, microsecond=0)
                return now.replace(hour=now.hour + 1, minute=mins[0], second=0, microsecond=0)
        
        # Handle specific hours
        if "-" in hour:
            start_h, end_h = map(int, hour.split("-"))
            hours = list(range(start_h, end_h + 1))
        elif "," in hour:
            hours = [int(h) for h in hour.split(",")]
        elif hour != "*":
            hours = [int(hour)]
        else:
            hours = list(range(24))
        
        # Find next valid time
        for h in hours:
            if h > now.hour or (h == now.hour and minute != "*"):
                target_min = 0
                if minute.startswith("*/"):
                    target_min = 0
                elif "," in minute:
                    target_min = int(minute.split(",")[0])
                elif minute != "*":
                    target_min = int(minute)
                
                if h > now.hour or target_min > now.minute:
                    return now.replace(hour=h, minute=target_min, second=0, microsecond=0)
        
        # Default: next occurrence tomorrow
        first_hour = hours[0] if hours else 0
        return (now + timedelta(days=1)).replace(hour=first_hour, minute=0, second=0, microsecond=0)
    except Exception:
        return None


def get_system_errors() -> List[SystemError]:
    """Get recent system errors from log files"""
    errors = []
    
    # Check for error logs
    log_paths = [
        "/home/jk/.openclaw/workspace/logs/email-webhooks.jsonl",
        "/home/jk/.openclaw/workspace/logs/kanbot-watcher-errors.log",
    ]
    
    for log_path in log_paths:
        if os.path.exists(log_path):
            try:
                with open(log_path, 'r') as f:
                    lines = f.readlines()
                    # Get last 10 lines
                    for line in lines[-10:]:
                        try:
                            entry = json.loads(line)
                            if 'error' in entry.get('type', '') or entry.get('level') in ['error', 'critical']:
                                errors.append(SystemError(
                                    timestamp=entry.get('timestamp', datetime.now(timezone.utc).isoformat()),
                                    source=os.path.basename(log_path),
                                    message=entry.get('message', str(entry)),
                                    severity=entry.get('level', 'error')
                                ))
                        except json.JSONDecodeError:
                            continue
            except Exception:
                continue
    
    return errors[-10:]  # Return last 10 errors


@router.get("/status", response_model=DashboardStats)
async def get_dashboard_status(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive dashboard status for Qratos monitoring"""
    
    # Get agent users (users with is_agent flag or agent-like names)
    agent_query = select(User).where(
        (User.username.contains("qratos")) | 
        (User.username.contains("agent")) |
        (User.email.contains("qratos"))
    )
    agent_result = await db.execute(agent_query)
    agent_users = agent_result.scalars().all()
    
    agents = []
    for agent in agent_users:
        # Get last activity for this agent
        last_activity_query = select(CardHistory).where(
            CardHistory.actor_id == str(agent.id)
        ).order_by(desc(CardHistory.created_at)).limit(1)
        last_activity_result = await db.execute(last_activity_query)
        last_activity = last_activity_result.scalar_one_or_none()
        
        status = "idle"
        if last_activity:
            last_seen = last_activity.created_at
            time_diff = datetime.now(timezone.utc) - last_seen
            if time_diff < timedelta(minutes=5):
                status = "active"
            elif time_diff < timedelta(hours=1):
                status = "idle"
            else:
                status = "offline"
        
        agents.append(AgentStatus(
            name=agent.username,
            status=status,
            last_seen=last_activity.created_at.isoformat() if last_activity else agent.created_at.isoformat(),
            current_task=last_activity.action if last_activity else None,
            space_id=None
        ))
    
    # Also add system agents that might not have user accounts
    system_agents = [
        AgentStatus(name="kanbot-watcher", status="active", last_seen=datetime.now(timezone.utc).isoformat()),
        AgentStatus(name="kanbot-proactive", status="active", last_seen=datetime.now(timezone.utc).isoformat()),
        AgentStatus(name="rate-limit-watchdog", status="active", last_seen=datetime.now(timezone.utc).isoformat()),
    ]
    agents.extend(system_agents)
    
    # Get recent tasks (card history from agents)
    recent_tasks_query = select(CardHistory).where(
        CardHistory.actor_type == "agent"
    ).order_by(desc(CardHistory.created_at)).limit(20)
    
    recent_tasks_result = await db.execute(recent_tasks_query)
    recent_tasks_raw = recent_tasks_result.scalars().all()
    
    recent_tasks = []
    for task in recent_tasks_raw:
        recent_tasks.append(RecentTask(
            id=str(task.id),
            action=task.action,
            actor_name=task.actor_name or task.actor_type,
            actor_type=task.actor_type,
            created_at=task.created_at.isoformat(),
            card_name=None,  # Would need to join with Card table
            space_name=None  # Would need to join through Card -> Column -> Space
        ))
    
    # Get cron job status
    cron_jobs = get_cron_status()
    
    # Get system errors
    errors = get_system_errors()
    
    # Calculate system health
    failed_crons = sum(1 for job in cron_jobs if job.status == "failed")
    error_count = len([e for e in errors if e.severity in ["error", "critical"]])
    offline_agents = sum(1 for agent in agents if agent.status == "offline")
    
    if error_count > 5 or failed_crons > 2 or offline_agents > 2:
        health_status = "critical"
    elif error_count > 0 or failed_crons > 0 or offline_agents > 0:
        health_status = "warning"
    else:
        health_status = "healthy"
    
    system_health = {
        "status": health_status,
        "agent_count": len(agents),
        "active_agents": sum(1 for a in agents if a.status == "active"),
        "cron_count": len(cron_jobs),
        "failed_crons": failed_crons,
        "error_count": error_count,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    return DashboardStats(
        agents=agents,
        cron_jobs=cron_jobs,
        recent_tasks=recent_tasks,
        errors=errors,
        system_health=system_health
    )
