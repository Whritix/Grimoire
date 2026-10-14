"""
Multi-tenant Support - Tenant models and quota management.
"""

import time
from typing import Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class TenantTier(str, Enum):
    """Tenant subscription tiers."""
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# Tier limits (tokens per day, requests per minute)
TIER_LIMITS = {
    TenantTier.FREE: {"tokens_per_day": 10000, "requests_per_minute": 10, "max_users": 5},
    TenantTier.STARTER: {"tokens_per_day": 100000, "requests_per_minute": 30, "max_users": 25},
    TenantTier.PRO: {"tokens_per_day": 500000, "requests_per_minute": 60, "max_users": 100},
    TenantTier.ENTERPRISE: {"tokens_per_day": 5000000, "requests_per_minute": 200, "max_users": -1},
}


@dataclass
class Tenant:
    """Represents a tenant (organization/team)."""
    tenant_id: str
    name: str
    tier: TenantTier = TenantTier.FREE
    created_at: datetime = field(default_factory=datetime.utcnow)
    settings: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    @property
    def limits(self) -> dict:
        return TIER_LIMITS.get(self.tier, TIER_LIMITS[TenantTier.FREE])
    
    def to_dict(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "name": self.name,
            "tier": self.tier.value,
            "created_at": self.created_at.isoformat(),
            "settings": self.settings,
            "limits": self.limits,
        }


@dataclass
class TenantUsage:
    """Tracks tenant resource usage."""
    tenant_id: str
    tokens_used_today: int = 0
    requests_this_minute: int = 0
    last_request_time: float = 0
    last_reset_date: str = ""
    
    def check_token_limit(self, tenant: Tenant) -> tuple[bool, str]:
        """Check if tenant is within token limits."""
        limit = tenant.limits["tokens_per_day"]
        if limit == -1:  # Unlimited
            return True, ""
        if self.tokens_used_today >= limit:
            return False, f"Daily token limit ({limit:,}) exceeded"
        return True, ""
    
    def check_rate_limit(self, tenant: Tenant) -> tuple[bool, str]:
        """Check if tenant is within rate limits."""
        limit = tenant.limits["requests_per_minute"]
        current_time = time.time()
        
        # Reset counter if more than a minute has passed
        if current_time - self.last_request_time > 60:
            self.requests_this_minute = 0
        
        if self.requests_this_minute >= limit:
            return False, f"Rate limit ({limit} req/min) exceeded"
        return True, ""
    
    def record_request(self, tokens: int = 0):
        """Record a request and token usage."""
        current_time = time.time()
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Reset daily counter if new day
        if self.last_reset_date != today:
            self.tokens_used_today = 0
            self.last_reset_date = today
        
        # Reset minute counter if more than a minute
        if current_time - self.last_request_time > 60:
            self.requests_this_minute = 0
        
        self.tokens_used_today += tokens
        self.requests_this_minute += 1
        self.last_request_time = current_time


@dataclass
class TenantAPIKey:
    """API key associated with a tenant."""
    key_id: str
    tenant_id: str
    key_hash: str  # Store hash, not actual key
    name: str
    permissions: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_used: datetime | None = None
    active: bool = True
    
    def has_permission(self, permission: str) -> bool:
        """Check if key has a specific permission."""
        # Wildcard permission
        if "*" in self.permissions:
            return True
        # Agent-specific permission
        if permission in self.permissions:
            return True
        # Check pattern (e.g., "planner:*" matches "planner:write")
        parts = permission.split(":")
        if len(parts) == 2:
            pattern = f"{parts[0]}:*"
            if pattern in self.permissions:
                return True
        return False


class TenantStore:
    """
    In-memory tenant store.
    In production, use database (Firestore, PostgreSQL, etc.)
    """
    
    def __init__(self):
        self.tenants: dict[str, Tenant] = {}
        self.usage: dict[str, TenantUsage] = {}
        self.api_keys: dict[str, TenantAPIKey] = {}
        
        # Create default tenant for development
        self._create_default_tenant()
    
    def _create_default_tenant(self):
        """Create a default tenant for development."""
        default = Tenant(
            tenant_id="default",
            name="Development Tenant",
            tier=TenantTier.PRO,
        )
        self.tenants["default"] = default
        self.usage["default"] = TenantUsage(tenant_id="default")
    
    def get_tenant(self, tenant_id: str) -> Tenant | None:
        return self.tenants.get(tenant_id)
    
    def get_usage(self, tenant_id: str) -> TenantUsage:
        if tenant_id not in self.usage:
            self.usage[tenant_id] = TenantUsage(tenant_id=tenant_id)
        return self.usage[tenant_id]
    
    def create_tenant(self, tenant_id: str, name: str, tier: TenantTier = TenantTier.FREE) -> Tenant:
        tenant = Tenant(tenant_id=tenant_id, name=name, tier=tier)
        self.tenants[tenant_id] = tenant
        self.usage[tenant_id] = TenantUsage(tenant_id=tenant_id)
        return tenant
    
    def get_tenant_by_api_key(self, key_hash: str) -> tuple[Tenant | None, TenantAPIKey | None]:
        """Look up tenant by API key hash."""
        for key in self.api_keys.values():
            if key.key_hash == key_hash and key.active:
                tenant = self.get_tenant(key.tenant_id)
                return tenant, key
        return None, None
    
    def add_api_key(self, key: TenantAPIKey):
        self.api_keys[key.key_id] = key


# Global store instance
_store = TenantStore()


def get_tenant_store() -> TenantStore:
    return _store
