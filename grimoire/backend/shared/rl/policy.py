"""
RL Policy Training - Offline policy learning from logged rewards.
Implements a contextual bandit with logging and batch training.
"""

import json
import time
from typing import Any, Literal
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from shared.utils import get_logger

logger = get_logger(__name__)

# Storage path for logs
LOG_PATH = Path(__file__).parent.parent.parent / "data" / "rl_logs"
LOG_PATH.mkdir(parents=True, exist_ok=True)


@dataclass
class RLDecision:
    """A logged RL decision with context and outcome."""
    decision_id: str
    user_id: str
    context: dict[str, Any]  # Signals at decision time
    action: Literal["easier", "same", "harder"]
    confidence: float
    timestamp: str
    reward: float | None = None  # Filled in when outcome known
    outcome_data: dict | None = None


@dataclass
class PolicyWeights:
    """Simple linear bandit weights for each action."""
    easier: dict[str, float] = field(default_factory=lambda: {
        "low_score": 0.3, "high_hints": 0.3, "slow_time": 0.2, "base": 0.1
    })
    same: dict[str, float] = field(default_factory=lambda: {
        "mid_score": 0.4, "moderate_hints": 0.3, "base": 0.2
    })
    harder: dict[str, float] = field(default_factory=lambda: {
        "high_score": 0.4, "low_hints": 0.3, "fast_time": 0.2, "base": 0.1
    })


class RLLogger:
    """Logs RL decisions for offline training."""
    
    def __init__(self, log_file: str = "rl_decisions.jsonl"):
        self.log_file = LOG_PATH / log_file
    
    def log_decision(self, decision: RLDecision):
        """Log a decision to file."""
        with open(self.log_file, "a") as f:
            f.write(json.dumps({
                "decision_id": decision.decision_id,
                "user_id": decision.user_id,
                "context": decision.context,
                "action": decision.action,
                "confidence": decision.confidence,
                "timestamp": decision.timestamp,
                "reward": decision.reward,
            }) + "\n")
        logger.info("RL decision logged", decision_id=decision.decision_id)
    
    def log_reward(self, decision_id: str, reward: float, outcome_data: dict | None = None):
        """Update a decision with its reward."""
        # In production, update database record
        reward_record = {
            "decision_id": decision_id,
            "reward": reward,
            "outcome_data": outcome_data,
            "recorded_at": datetime.utcnow().isoformat()
        }
        
        rewards_file = LOG_PATH / "rewards.jsonl"
        with open(rewards_file, "a") as f:
            f.write(json.dumps(reward_record) + "\n")
        
        logger.info("Reward logged", decision_id=decision_id, reward=reward)
    
    def get_logged_decisions(self, limit: int = 1000) -> list[dict]:
        """Read logged decisions for training."""
        decisions = []
        if self.log_file.exists():
            with open(self.log_file, "r") as f:
                for line in f:
                    if line.strip():
                        decisions.append(json.loads(line))
                        if len(decisions) >= limit:
                            break
        return decisions


class ContextualBanditPolicy:
    """
    Simple contextual bandit for adaptive difficulty.
    Maps context features to action probabilities.
    """
    
    def __init__(self):
        self.weights = PolicyWeights()
        self.exploration_rate = 0.1
    
    def compute_features(self, signals: dict) -> dict[str, float]:
        """Extract features from learning signals."""
        scores = signals.get("recent_quiz_scores", [])
        avg_score = sum(scores) / len(scores) if scores else 0.7
        hints = signals.get("hints_used", 0)
        time_spent = signals.get("time_spent_minutes", 0)
        expected_time = signals.get("expected_time_minutes", 30)
        
        return {
            "low_score": 1.0 if avg_score < 0.5 else 0.0,
            "mid_score": 1.0 if 0.5 <= avg_score < 0.85 else 0.0,
            "high_score": 1.0 if avg_score >= 0.85 else 0.0,
            "high_hints": 1.0 if hints >= 5 else 0.0,
            "moderate_hints": 1.0 if 1 <= hints < 5 else 0.0,
            "low_hints": 1.0 if hints <= 1 else 0.0,
            "slow_time": 1.0 if time_spent > expected_time * 1.5 else 0.0,
            "fast_time": 1.0 if time_spent < expected_time * 0.7 else 0.0,
            "base": 1.0,
        }
    
    def compute_action_score(self, features: dict, action: str) -> float:
        """Compute score for an action given features."""
        weights = getattr(self.weights, action)
        score = sum(features.get(k, 0) * v for k, v in weights.items())
        return score
    
    def select_action(self, signals: dict) -> tuple[str, float, str]:
        """
        Select best action given context.
        
        Returns: (action, confidence, rationale)
        """
        import random
        
        features = self.compute_features(signals)
        
        # Epsilon-greedy exploration
        if random.random() < self.exploration_rate:
            action = random.choice(["easier", "same", "harder"])
            return action, 0.5, "Exploration: random action selected"
        
        # Compute scores for each action
        scores = {
            "easier": self.compute_action_score(features, "easier"),
            "same": self.compute_action_score(features, "same"),
            "harder": self.compute_action_score(features, "harder"),
        }
        
        # Select best action
        best_action = max(scores, key=scores.get)
        total = sum(scores.values())
        confidence = scores[best_action] / total if total > 0 else 0.33
        
        # Generate rationale
        active_features = [k for k, v in features.items() if v > 0 and k != "base"]
        rationale = f"Based on {', '.join(active_features) or 'default policy'}"
        
        return best_action, min(0.95, confidence), rationale
    
    def update_weights(self, decisions: list[dict], learning_rate: float = 0.1):
        """
        Batch update policy weights from logged decisions.
        Simple gradient update based on rewards.
        """
        updates = {"easier": {}, "same": {}, "harder": {}}
        counts = {"easier": 0, "same": 0, "harder": 0}
        
        for decision in decisions:
            if decision.get("reward") is None:
                continue
            
            action = decision["action"]
            reward = decision["reward"]
            features = self.compute_features(decision["context"])
            
            counts[action] += 1
            
            # Accumulate gradient (reward * feature)
            for feature, value in features.items():
                if feature not in updates[action]:
                    updates[action][feature] = 0
                updates[action][feature] += reward * value
        
        # Apply updates
        for action in ["easier", "same", "harder"]:
            if counts[action] > 0:
                weights = getattr(self.weights, action)
                for feature, delta in updates[action].items():
                    if feature in weights:
                        avg_delta = delta / counts[action]
                        weights[feature] += learning_rate * avg_delta
                        # Clip weights to reasonable range
                        weights[feature] = max(0.0, min(1.0, weights[feature]))
        
        logger.info(
            "Policy weights updated",
            decisions_used=sum(counts.values()),
            counts=counts
        )
    
    def save_weights(self, path: Path | None = None):
        """Save policy weights to file."""
        path = path or LOG_PATH / "policy_weights.json"
        with open(path, "w") as f:
            json.dump({
                "easier": self.weights.easier,
                "same": self.weights.same,
                "harder": self.weights.harder,
                "saved_at": datetime.utcnow().isoformat()
            }, f, indent=2)
        logger.info("Policy weights saved", path=str(path))
    
    def load_weights(self, path: Path | None = None):
        """Load policy weights from file."""
        path = path or LOG_PATH / "policy_weights.json"
        if path.exists():
            with open(path, "r") as f:
                data = json.load(f)
            self.weights.easier = data.get("easier", self.weights.easier)
            self.weights.same = data.get("same", self.weights.same)
            self.weights.harder = data.get("harder", self.weights.harder)
            logger.info("Policy weights loaded", path=str(path))


# Global instances
_logger = RLLogger()
_policy = ContextualBanditPolicy()


def get_rl_logger() -> RLLogger:
    return _logger


def get_policy() -> ContextualBanditPolicy:
    return _policy


def train_policy_from_logs(limit: int = 1000, learning_rate: float = 0.1):
    """Run batch training from logged decisions."""
    decisions = _logger.get_logged_decisions(limit)
    _policy.update_weights(decisions, learning_rate)
    _policy.save_weights()
    return len(decisions)


def extract_signals_from_activity(user_id: str) -> dict:
    """
    Extract RL signals from user activity logs.
    Pulls quiz scores, lesson completions, and other metrics.
    """
    try:
        from shared.activity import get_user_activity
        from shared.activity.logger import get_user_profile
        
        profile = get_user_profile(user_id)
        activities = get_user_activity(user_id, limit=50)
        
        # Extract recent quiz scores
        quiz_activities = [a for a in activities if a.get("type") == "quiz_taken"]
        recent_scores = []
        for q in quiz_activities[-10:]:
            score = q.get("data", {}).get("score")
            if score is not None:
                recent_scores.append(score)
        
        # Count hints used from recent activities
        hints_used = 0
        for a in activities[-20:]:
            hints_used += a.get("data", {}).get("hints_used", 0)
        
        # Calculate time spent
        time_spent = 0
        for a in activities[-20:]:
            time_spent += a.get("data", {}).get("duration_minutes", 0)
        
        # Get stats
        stats = profile.get("stats", {})
        
        return {
            "recent_quiz_scores": recent_scores or [0.7],  # Default if no data
            "hints_used": hints_used,
            "time_spent_minutes": time_spent,
            "retention_results": [],
            "streak_days": 0,
            "lessons_completed": stats.get("lessons_completed", 0),
            "quizzes_taken": stats.get("quizzes_taken", 0),
            "videos_analyzed": stats.get("videos_analyzed", 0),
        }
    except Exception as e:
        logger.error("Failed to extract signals from activity", error=str(e))
        return {
            "recent_quiz_scores": [0.7],
            "hints_used": 0,
            "time_spent_minutes": 0,
        }


def calculate_reward_from_outcome(outcome: dict) -> float:
    """
    Calculate RL reward from learning outcome.
    Higher reward for good performance, lower for struggles.
    """
    score = outcome.get("score", 0.7)
    completion = outcome.get("completed", False)
    time_ratio = outcome.get("time_ratio", 1.0)  # actual/expected
    
    # Base reward from score
    reward = score
    
    # Bonus for completion
    if completion:
        reward += 0.1
    
    # Adjust for time (too fast might mean too easy, too slow = too hard)
    if 0.7 <= time_ratio <= 1.3:
        reward += 0.1  # Optimal time range
    elif time_ratio > 2.0:
        reward -= 0.2  # Too slow, content was too hard
    elif time_ratio < 0.5:
        reward -= 0.1  # Too fast, content was too easy
    
    return max(0.0, min(1.0, reward))


def auto_train_from_activity(user_id: str, limit: int = 100):
    """
    Automatically train policy from a user's activity data.
    Creates synthetic decisions from activity patterns.
    """
    try:
        from shared.activity import get_user_activity
        
        activities = get_user_activity(user_id, limit=limit)
        
        # Find quiz/lesson outcomes and create training data
        training_data = []
        for a in activities:
            if a.get("type") in ["quiz_taken", "lesson_completed"]:
                data = a.get("data", {})
                
                # Determine what difficulty was used
                difficulty = data.get("difficulty", "same")
                
                # Calculate reward
                reward = calculate_reward_from_outcome({
                    "score": data.get("score", 0.7),
                    "completed": True,
                    "time_ratio": 1.0,
                })
                
                training_data.append({
                    "action": difficulty if difficulty in ["easier", "same", "harder"] else "same",
                    "reward": reward,
                    "context": extract_signals_from_activity(user_id),
                })
        
        if training_data:
            _policy.update_weights(training_data, learning_rate=0.05)
            _policy.save_weights()
            logger.info("Auto-trained from activity", user_id=user_id, samples=len(training_data))
        
        return len(training_data)
    except Exception as e:
        logger.error("Auto-training failed", error=str(e))
        return 0
