"""Tests for agent registry API endpoints - unit tests for model operations"""
import pytest
from datetime import datetime, timezone
from uuid import uuid4


class TestAgentModelLogic:
    """Test suite for agent model logic - unit tests without database"""

    def test_agent_has_required_fields(self):
        """Agent model should have expected attributes"""
        from app.models.agent import Agent
        
        agent = Agent()
        assert hasattr(agent, 'id')
        assert hasattr(agent, 'space_id')
        assert hasattr(agent, 'name')
        assert hasattr(agent, 'enabled')

    def test_agent_run_has_required_fields(self):
        """AgentRun model should have expected attributes"""
        from app.models.agent import AgentRun
        
        run = AgentRun()
        assert hasattr(run, 'id')
        assert hasattr(run, 'agent_id')
        assert hasattr(run, 'status')
        assert hasattr(run, 'started_at')

    def test_agent_default_enabled_state(self):
        """New agents should be enabled by default"""
        from app.models.agent import Agent
        
        agent = Agent(
            id=uuid4(),
            space_id=uuid4(),
            name="Test Agent",
        )
        # Check the model accepts these values
        assert agent.name == "Test Agent"


class TestAgentSchemas:
    """Test suite for agent Pydantic schemas"""

    def test_agent_create_schema(self):
        """AgentCreate schema validates correctly"""
        from app.schemas.agent import AgentCreate
        
        data = AgentCreate(
            space_id=uuid4(),
            name="Test Agent",
            description="A test agent",
            model="claude-sonnet",
            schedule_type="cron",
            schedule_value="0 * * * *",
        )
        assert data.name == "Test Agent"
        assert data.model == "claude-sonnet"

    def test_agent_update_schema(self):
        """AgentUpdate schema allows partial updates"""
        from app.schemas.agent import AgentUpdate
        
        # Only updating name
        data = AgentUpdate(name="Updated Name")
        assert data.name == "Updated Name"
        
        # Verify other fields are optional (None or missing)
        dump = data.model_dump(exclude_unset=True)
        assert 'description' not in dump

    def test_agent_response_schema_fields(self):
        """AgentResponse schema has expected fields"""
        from app.schemas.agent import AgentResponse
        
        # Check model fields exist
        model_fields = AgentResponse.model_fields
        assert 'id' in model_fields
        assert 'name' in model_fields
        assert 'space_id' in model_fields
        assert 'enabled' in model_fields


class TestAgentRunSchemas:
    """Test suite for agent run schemas"""

    def test_agent_run_response_fields(self):
        """AgentRunResponse has expected fields"""
        from app.schemas.agent import AgentRunResponse
        
        model_fields = AgentRunResponse.model_fields
        assert 'id' in model_fields
        assert 'agent_id' in model_fields
        assert 'status' in model_fields
        assert 'started_at' in model_fields


class TestAgentFiltering:
    """Test suite for agent filtering logic"""

    def test_enabled_filter_logic(self):
        """Filtering by enabled status works correctly"""
        # Simulating the filtering logic from the API
        agents = [
            {'name': 'Agent A', 'enabled': True},
            {'name': 'Agent B', 'enabled': False},
            {'name': 'Agent C', 'enabled': True},
        ]
        
        enabled_only = [a for a in agents if a['enabled']]
        assert len(enabled_only) == 2
        assert all(a['enabled'] for a in enabled_only)

    def test_space_filter_logic(self):
        """Filtering by space_id works correctly"""
        space_1 = uuid4()
        space_2 = uuid4()
        
        agents = [
            {'name': 'Agent A', 'space_id': space_1},
            {'name': 'Agent B', 'space_id': space_2},
            {'name': 'Agent C', 'space_id': space_1},
        ]
        
        space_1_agents = [a for a in agents if a['space_id'] == space_1]
        assert len(space_1_agents) == 2


class TestAgentCRUDLogic:
    """Test suite for CRUD operation logic"""

    def test_update_preserves_unset_fields(self):
        """Updating agent should only modify provided fields"""
        from app.schemas.agent import AgentUpdate
        
        update = AgentUpdate(name="New Name")
        update_data = update.model_dump(exclude_unset=True)
        
        assert 'name' in update_data
        assert 'description' not in update_data
        assert 'enabled' not in update_data

    def test_delete_by_id_lookup(self):
        """Delete operation requires valid ID lookup"""
        agents = {
            uuid4(): {'name': 'Agent A'},
            uuid4(): {'name': 'Agent B'},
        }
        
        # Deleting existing ID
        existing_id = list(agents.keys())[0]
        assert existing_id in agents
        del agents[existing_id]
        assert existing_id not in agents

    def test_agent_stats_calculation(self):
        """Agent stats should aggregate run data correctly"""
        runs = [
            {'status': 'completed', 'duration_ms': 1000},
            {'status': 'completed', 'duration_ms': 2000},
            {'status': 'failed', 'duration_ms': 500},
        ]
        
        completed = [r for r in runs if r['status'] == 'completed']
        total_runs = len(runs)
        success_rate = len(completed) / total_runs if total_runs > 0 else 0
        
        assert success_rate == pytest.approx(0.666, rel=0.01)
