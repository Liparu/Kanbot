#!/usr/bin/env python3
"""
Multi-Profile Agent Setup Verification Script

This script verifies that a multi-profile agent setup is correctly configured
and secure. Run this after setting up profiles to ensure everything works.

Usage:
    python verify_multiprofile.py --config agent_config.json

Config file format:
{
  "kanbot_url": "http://localhost:8000",
  "profiles": [
    {
      "id": "alice",
      "email": "agent-for-alice@company.com",
      "api_key": "kb_alice_xxxxx..."
    },
    {
      "id": "bob",
      "email": "agent-for-bob@company.com",
      "api_key": "kb_bob_yyyyy..."
    }
  ]
}
"""

import sys
import json
import requests
from typing import Dict, List, Any
from dataclasses import dataclass


@dataclass
class Profile:
    id: str
    email: str
    api_key: str


class MultiProfileVerifier:
    def __init__(self, kanbot_url: str, profiles: List[Profile]):
        self.kanbot_url = kanbot_url.rstrip('/')
        self.profiles = profiles
        self.results = []
    
    def verify_all(self) -> bool:
        """Run all verification tests."""
        print("=" * 70)
        print("Multi-Profile Agent Setup Verification")
        print("=" * 70)
        print()
        
        all_passed = True
        
        # Test 1: API connectivity
        print("Test 1: API Connectivity")
        if not self._test_connectivity():
            all_passed = False
        print()
        
        # Test 2: API key authentication
        print("Test 2: API Key Authentication")
        if not self._test_authentication():
            all_passed = False
        print()
        
        # Test 3: Profile isolation
        print("Test 3: Profile Isolation")
        if not self._test_isolation():
            all_passed = False
        print()
        
        # Test 4: Profile uniqueness
        print("Test 4: Profile Uniqueness")
        if not self._test_uniqueness():
            all_passed = False
        print()
        
        # Test 5: Security headers
        print("Test 5: Security Headers")
        if not self._test_security_headers():
            all_passed = False
        print()
        
        # Summary
        print("=" * 70)
        if all_passed:
            print("✅ All tests passed! Multi-profile setup is correct.")
        else:
            print("❌ Some tests failed. Review the output above.")
        print("=" * 70)
        
        return all_passed
    
    def _test_connectivity(self) -> bool:
        """Test basic API connectivity."""
        try:
            response = requests.get(f"{self.kanbot_url}/health", timeout=5)
            if response.status_code == 200:
                print("  ✅ API is reachable")
                return True
            else:
                print(f"  ❌ API returned status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Cannot connect to API: {e}")
            return False
    
    def _test_authentication(self) -> bool:
        """Test that each profile can authenticate."""
        all_passed = True
        
        for profile in self.profiles:
            try:
                headers = {"X-API-Key": profile.api_key}
                response = requests.get(
                    f"{self.kanbot_url}/api/v1/users/me",
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code == 200:
                    user = response.json()
                    if user['email'] == profile.email:
                        print(f"  ✅ {profile.id}: Authenticated as {profile.email}")
                    else:
                        print(f"  ❌ {profile.id}: Key maps to wrong user ({user['email']})")
                        all_passed = False
                else:
                    print(f"  ❌ {profile.id}: Authentication failed ({response.status_code})")
                    all_passed = False
            except Exception as e:
                print(f"  ❌ {profile.id}: Error - {e}")
                all_passed = False
        
        return all_passed
    
    def _test_isolation(self) -> bool:
        """Test that profiles can only see their own data."""
        all_passed = True
        
        # Get spaces for each profile
        profile_spaces: Dict[str, List[Dict]] = {}
        
        for profile in self.profiles:
            try:
                headers = {"X-API-Key": profile.api_key}
                response = requests.get(
                    f"{self.kanbot_url}/api/v1/spaces",
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code == 200:
                    data = response.json()
                    spaces = data.get('spaces', [])
                    profile_spaces[profile.id] = spaces
                    
                    # Verify all spaces belong to this user
                    for space in spaces:
                        # Check if user is owner or member
                        is_owner = space.get('owner_email') == profile.email
                        is_member = any(
                            m.get('email') == profile.email
                            for m in space.get('members', [])
                        )
                        
                        if not (is_owner or is_member):
                            print(f"  ❌ {profile.id}: Has access to space '{space['name']}' "
                                  f"without being owner/member")
                            all_passed = False
                    
                    print(f"  ✅ {profile.id}: Can access {len(spaces)} space(s)")
                else:
                    print(f"  ❌ {profile.id}: Cannot fetch spaces ({response.status_code})")
                    all_passed = False
            except Exception as e:
                print(f"  ❌ {profile.id}: Error - {e}")
                all_passed = False
        
        # Check for unexpected overlap
        if len(self.profiles) >= 2:
            for i, profile1 in enumerate(self.profiles):
                for profile2 in self.profiles[i+1:]:
                    spaces1 = {s['id'] for s in profile_spaces.get(profile1.id, [])}
                    spaces2 = {s['id'] for s in profile_spaces.get(profile2.id, [])}
                    overlap = spaces1 & spaces2
                    
                    if overlap:
                        print(f"  ⚠️  {profile1.id} and {profile2.id} share {len(overlap)} space(s) "
                              f"(This is OK if they're collaborating)")
        
        return all_passed
    
    def _test_uniqueness(self) -> bool:
        """Test that each profile has a unique API key and user account."""
        all_passed = True
        
        # Check for duplicate API keys
        api_keys = [p.api_key for p in self.profiles]
        if len(api_keys) != len(set(api_keys)):
            print("  ❌ Duplicate API keys detected!")
            all_passed = False
        else:
            print("  ✅ All API keys are unique")
        
        # Check for duplicate emails
        emails = [p.email for p in self.profiles]
        if len(emails) != len(set(emails)):
            print("  ❌ Duplicate email addresses detected!")
            all_passed = False
        else:
            print("  ✅ All email addresses are unique")
        
        # Check that API keys map to correct users
        for profile in self.profiles:
            try:
                headers = {"X-API-Key": profile.api_key}
                response = requests.get(
                    f"{self.kanbot_url}/api/v1/users/me",
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code == 200:
                    user = response.json()
                    if user['email'] != profile.email:
                        print(f"  ❌ {profile.id}: API key maps to {user['email']}, "
                              f"expected {profile.email}")
                        all_passed = False
            except Exception as e:
                print(f"  ❌ {profile.id}: Error - {e}")
                all_passed = False
        
        if all_passed:
            print(f"  ✅ All {len(self.profiles)} profiles are correctly mapped")
        
        return all_passed
    
    def _test_security_headers(self) -> bool:
        """Test that security headers are present."""
        all_passed = True
        
        try:
            response = requests.get(f"{self.kanbot_url}/api/v1/health", timeout=5)
            headers = response.headers
            
            # Check for important security headers
            security_checks = {
                "X-Content-Type-Options": "Security headers present",
                "X-Frame-Options": "Clickjacking protection",
            }
            
            for header, description in security_checks.items():
                if header in headers:
                    print(f"  ✅ {description} ({header})")
                else:
                    print(f"  ⚠️  Missing {description} ({header})")
            
            # Check if HTTPS is used in production
            if self.kanbot_url.startswith("http://") and "localhost" not in self.kanbot_url:
                print("  ⚠️  Using HTTP instead of HTTPS (not recommended for production)")
            elif self.kanbot_url.startswith("https://"):
                print("  ✅ Using HTTPS")
            
        except Exception as e:
            print(f"  ❌ Error checking headers: {e}")
            all_passed = False
        
        return all_passed


def load_config(config_path: str) -> tuple:
    """Load configuration from JSON file."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        kanbot_url = config['kanbot_url']
        profiles = [
            Profile(
                id=p['id'],
                email=p['email'],
                api_key=p['api_key']
            )
            for p in config['profiles']
        ]
        
        return kanbot_url, profiles
    except Exception as e:
        print(f"Error loading config: {e}")
        sys.exit(1)


def main():
    if len(sys.argv) != 3 or sys.argv[1] != '--config':
        print("Usage: python verify_multiprofile.py --config agent_config.json")
        sys.exit(1)
    
    config_path = sys.argv[2]
    kanbot_url, profiles = load_config(config_path)
    
    print(f"Kanbot URL: {kanbot_url}")
    print(f"Profiles: {len(profiles)}")
    for p in profiles:
        print(f"  - {p.id} ({p.email})")
    print()
    
    verifier = MultiProfileVerifier(kanbot_url, profiles)
    success = verifier.verify_all()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
