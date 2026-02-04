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
    """Read cron job status from state files"""
    cron_jobs = []
    
    # Define cron jobs and their schedules
    cron_configs = [
        {"name": "kanbot-watcher", "schedule": "*/5 * * * *", "state_file": ".kanbot-watcher-state.json"},
        {"name": "kanbot-proactive", "schedule": "0 */6 * * *", "state_file": ".kanbot-proactive-state.json"},
        {"name": "calendar-sync", "schedule": "*/10 * * * *", "state_file": ".calendar-sync-state.json"},
        {"name": "nas-pipeline", "schedule": "0 2 * * *", "state_file": ".nas-pipeline-state.json"},
        {"name": "rate-limit-watchdog", "schedule": "*/15 * * * *", "state_file": None},
        {"name": "email-check", "schedule": "*/3 * * * *", "state_file": None},
    ]
    
    workspace_path = "/home/jk/.openclaw/workspace/scripts"
    
    for config in cron_configs:
        status = "unknown"
        last_run = None
        next_run = None
        
        if config["state_file"]:
            state_path = os.path.join(workspace_path, config["state_file"])
            if os.path.exists(state_path):
                try:
                    with open(state_path, 'r') as f:
                        state = json.load(f)
                    last_run = state.get('last_run')
                    next_run = state.get('next_run')
                    status = state.get('status', 'unknown')
                except Exception:
                    status = "error"
        
        cron_jobs.append(CronJobStatus(
            name=config["name"],
            status=status,
            last_run=last_run,
            next_run=next_run,
            schedule=config["schedule"]
        ))
    
    return cron_jobs


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
        CardHistory.actor_type.in_(["agent", "automation"])
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
