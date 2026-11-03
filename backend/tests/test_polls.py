"""
Comprehensive automated tests for TailorBird Polls system:
- Standalone polls
- Permanent outfit posts with optional polls
- 24-hour outfit moments with optional polls
- Creator voting prevention by default
- Vote changing policies
- Dynamic vote calculation and percentages
- Expiration enforcement
- Results visibility before and after voting
- Poll deletion permissions
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.post import Post
from app.models.poll import Poll, PollOption, PollVote
from app.repositories.poll_repository import PollRepository
from app.core.security import create_access_token

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_tables():
    """PollRepository handles table existence check and resilient fallback."""
    yield


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_test_user(db, prefix="poll_user"):
    unique = uuid.uuid4().hex[:8]
    user = User(
        username=f"{prefix}_{unique}",
        email=f"{prefix}_{unique}@example.com",
        first_name="Poll",
        last_name=f"Tester {unique}",
        password_hash="fakehashedpassword",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=str(user.id))
    return user, token


def test_create_standalone_poll_success(db_session):
    creator, token = create_test_user(db_session, "creator")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "question": "Which jacket should I wear for date night?",
        "options": ["Black Leather Jacket", "Camel Trench Coat", "Denim Jacket"],
        "duration_hours": 48,
        "allow_vote_change": False,
        "show_results_before_vote": False,
        "allow_creator_vote": False,
    }

    res = client.post("/api/v1/polls", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["question"] == payload["question"]
    assert data["content_type"] == "standalone"
    assert len(data["options"]) == 3
    assert data["allow_vote_change"] is False
    assert data["allow_creator_vote"] is False
    assert data["show_results_before_vote"] is False
    assert data["has_voted"] is False
    assert data["is_expired"] is False
    assert data["time_remaining_seconds"] > 0


def test_create_poll_validation_min_max_options(db_session):
    creator, token = create_test_user(db_session, "creator_val")
    headers = {"Authorization": f"Bearer {token}"}

    # Fewer than 2 options
    res_few = client.post("/api/v1/polls", json={
        "question": "Is one option enough?",
        "options": ["Only one"],
    }, headers=headers)
    assert res_few.status_code == 422

    # More than 6 options
    res_many = client.post("/api/v1/polls", json={
        "question": "Too many options?",
        "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4", "Opt 5", "Opt 6", "Opt 7"],
    }, headers=headers)
    assert res_many.status_code == 422


def test_creator_cannot_vote_by_default(db_session):
    creator, token = create_test_user(db_session, "creator_novote")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/polls", json={
        "question": "Should creator be unbiased?",
        "options": ["Yes", "No"],
        "allow_creator_vote": False,
    }, headers=headers)
    assert res.status_code == 201
    poll = res.json()
    opt_id = poll["options"][0]["id"]

    # Creator tries to vote
    vote_res = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt_id}, headers=headers)
    assert vote_res.status_code == 400
    assert "Creator cannot vote on their own poll" in vote_res.json()["detail"]


def test_creator_can_vote_if_configured(db_session):
    creator, token = create_test_user(db_session, "creator_canvote")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/polls", json={
        "question": "Creator voting enabled?",
        "options": ["Option A", "Option B"],
        "allow_creator_vote": True,
    }, headers=headers)
    assert res.status_code == 201
    poll = res.json()
    opt_id = poll["options"][0]["id"]

    vote_res = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt_id}, headers=headers)
    assert vote_res.status_code == 200
    assert vote_res.json()["has_voted"] is True
    assert vote_res.json()["user_voted_option_id"] == opt_id


def test_results_hidden_before_voting_when_configured(db_session):
    creator, c_token = create_test_user(db_session, "c_hidden")
    voter, v_token = create_test_user(db_session, "v_hidden")

    # Poll with show_results_before_vote = False
    res = client.post("/api/v1/polls", json={
        "question": "Hidden results test?",
        "options": ["Choice 1", "Choice 2"],
        "show_results_before_vote": False,
    }, headers={"Authorization": f"Bearer {c_token}"})
    assert res.status_code == 201
    poll_id = res.json()["id"]

    # Voter views poll before voting
    view_res = client.get(f"/api/v1/polls/{poll_id}", headers={"Authorization": f"Bearer {v_token}"})
    assert view_res.status_code == 200
    view_data = view_res.json()

    assert view_data["has_voted"] is False
    assert view_data["total_votes"] is None
    for opt in view_data["options"]:
        assert opt["vote_count"] is None
        assert opt["percentage"] is None

    # Now voter votes
    opt1_id = view_data["options"][0]["id"]
    vote_res = client.post(f"/api/v1/polls/{poll_id}/vote", json={"option_id": opt1_id}, headers={"Authorization": f"Bearer {v_token}"})
    assert vote_res.status_code == 200
    voted_data = vote_res.json()

    # After voting, results become visible
    assert voted_data["has_voted"] is True
    assert voted_data["total_votes"] == 1
    assert voted_data["options"][0]["vote_count"] == 1
    assert voted_data["options"][0]["percentage"] == 100.0
    assert voted_data["options"][1]["vote_count"] == 0
    assert voted_data["options"][1]["percentage"] == 0.0


def test_vote_change_policy_rejected_when_disallowed(db_session):
    creator, c_token = create_test_user(db_session, "c_nochange")
    voter, v_token = create_test_user(db_session, "v_nochange")

    res = client.post("/api/v1/polls", json={
        "question": "Strict one-vote poll?",
        "options": ["First Choice", "Second Choice"],
        "allow_vote_change": False,
    }, headers={"Authorization": f"Bearer {c_token}"})
    assert res.status_code == 201
    poll = res.json()
    opt1 = poll["options"][0]["id"]
    opt2 = poll["options"][1]["id"]

    # First vote
    v1 = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt1}, headers={"Authorization": f"Bearer {v_token}"})
    assert v1.status_code == 200

    # Second vote attempt (change)
    v2 = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt2}, headers={"Authorization": f"Bearer {v_token}"})
    assert v2.status_code == 400
    assert "Vote changing is not allowed" in v2.json()["detail"]


def test_vote_change_allowed_when_enabled(db_session):
    creator, c_token = create_test_user(db_session, "c_changeok")
    voter, v_token = create_test_user(db_session, "v_changeok")

    res = client.post("/api/v1/polls", json={
        "question": "Flexible voting poll?",
        "options": ["Option Red", "Option Blue"],
        "allow_vote_change": True,
    }, headers={"Authorization": f"Bearer {c_token}"})
    assert res.status_code == 201
    poll = res.json()
    opt_red = poll["options"][0]["id"]
    opt_blue = poll["options"][1]["id"]

    # Vote for Red
    v1 = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt_red}, headers={"Authorization": f"Bearer {v_token}"})
    assert v1.status_code == 200
    assert v1.json()["user_voted_option_id"] == opt_red
    assert v1.json()["total_votes"] == 1
    assert v1.json()["options"][0]["vote_count"] == 1

    # Change vote to Blue
    v2 = client.post(f"/api/v1/polls/{poll['id']}/vote", json={"option_id": opt_blue}, headers={"Authorization": f"Bearer {v_token}"})
    assert v2.status_code == 200
    data2 = v2.json()
    assert data2["user_voted_option_id"] == opt_blue
    assert data2["total_votes"] == 1  # Still 1 total vote, not 2!
    assert data2["options"][0]["vote_count"] == 0
    assert data2["options"][1]["vote_count"] == 1
    assert data2["options"][1]["percentage"] == 100.0


def test_voting_on_expired_poll_rejected(db_session):
    creator, c_token = create_test_user(db_session, "c_expired")
    voter, v_token = create_test_user(db_session, "v_expired")

    repo = PollRepository(db_session)
    poll = repo.create_poll(
        creator_user_id=creator.id,
        question="Did this poll expire?",
        options=["Yes", "No"],
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        content_type="standalone",
        allow_creator_vote=False,
    )
    opt1_id = str(poll.options[0].id)

    # Try to vote
    res = client.post(f"/api/v1/polls/{poll.id}/vote", json={"option_id": opt1_id}, headers={"Authorization": f"Bearer {v_token}"})
    assert res.status_code == 400
    assert "This poll has closed" in res.json()["detail"]

    # Results should be viewable even before voting when expired
    view_res = client.get(f"/api/v1/polls/{poll.id}", headers={"Authorization": f"Bearer {v_token}"})
    assert view_res.status_code == 200
    assert view_res.json()["is_expired"] is True
    assert view_res.json()["total_votes"] == 0


def test_permanent_post_with_optional_poll(db_session):
    creator, token = create_test_user(db_session, "post_author")
    headers = {"Authorization": f"Bearer {token}"}

    post_payload = {
        "caption": "Styling this oversized blazer for autumn. Thoughts on footwear?",
        "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
        "tags": ["autumn", "blazer"],
        "poll": {
            "question": "Which shoes fit this look better?",
            "options": ["Chunky Loafers", "Ankle Boots", "White Sneakers"],
            "duration_hours": 72,
            "allow_vote_change": True,
        }
    }

    res = client.post("/api/v1/posts", json=post_payload, headers=headers)
    assert res.status_code == 201, res.text
    post_data = res.json()

    assert post_data["poll"] is not None
    poll = post_data["poll"]
    assert poll["question"] == "Which shoes fit this look better?"
    assert poll["content_type"] == "post"
    assert poll["post_id"] == post_data["id"]
    assert len(poll["options"]) == 3

    # Feed fetching includes the poll
    feed_res = client.get(f"/api/v1/posts/{post_data['id']}", headers=headers)
    assert feed_res.status_code == 200
    assert feed_res.json()["poll"]["id"] == poll["id"]


def test_24h_moment_with_optional_poll(db_session):
    creator, token = create_test_user(db_session, "moment_author")
    headers = {"Authorization": f"Bearer {token}"}

    moment_payload = {
        "caption": "Quick fit check for today's casual meetings!",
        "image_url": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d",
        "occasion": "Work & Office",
        "tags": ["workfit"],
        "poll": {
            "question": "Tie or no tie?",
            "options": ["Silk Tie", "Open Collar"],
        }
    }

    res = client.post("/api/v1/moments", json=moment_payload, headers=headers)
    assert res.status_code == 201, res.text
    moment_data = res.json()

    assert moment_data["poll"] is not None
    poll = moment_data["poll"]
    assert poll["content_type"] == "moment"
    assert poll["post_id"] == moment_data["id"]
    assert len(poll["options"]) == 2
    # Poll expires when moment expires (within 5 seconds of moment expires_at)
    poll_exp = datetime.fromisoformat(poll["expires_at"].replace("Z", "+00:00"))
    moment_exp = datetime.fromisoformat(moment_data["expires_at"].replace("Z", "+00:00"))
    assert abs((poll_exp - moment_exp).total_seconds()) < 5


def test_delete_poll_permissions(db_session):
    creator, c_token = create_test_user(db_session, "c_del")
    stranger, s_token = create_test_user(db_session, "s_del")

    res = client.post("/api/v1/polls", json={
        "question": "Can stranger delete me?",
        "options": ["No", "Never"],
    }, headers={"Authorization": f"Bearer {c_token}"})
    poll_id = res.json()["id"]

    # Stranger tries to delete
    del_stranger = client.delete(f"/api/v1/polls/{poll_id}", headers={"Authorization": f"Bearer {s_token}"})
    assert del_stranger.status_code == 403

    # Creator deletes
    del_creator = client.delete(f"/api/v1/polls/{poll_id}", headers={"Authorization": f"Bearer {c_token}"})
    assert del_creator.status_code == 204

    # Now poll is gone
    get_res = client.get(f"/api/v1/polls/{poll_id}", headers={"Authorization": f"Bearer {c_token}"})
    assert get_res.status_code == 404


def test_vote_invalid_option_rejected(db_session):
    creator, c_token = create_test_user(db_session, "c_invalid")
    voter, v_token = create_test_user(db_session, "v_invalid")

    res = client.post("/api/v1/polls", json={
        "question": "Invalid option test?",
        "options": ["A", "B"],
    }, headers={"Authorization": f"Bearer {c_token}"})
    poll_id = res.json()["id"]

    random_opt_id = str(uuid.uuid4())
    vote_res = client.post(f"/api/v1/polls/{poll_id}/vote", json={"option_id": random_opt_id}, headers={"Authorization": f"Bearer {v_token}"})
    assert vote_res.status_code == 400
    assert "Selected option does not belong to this poll" in vote_res.json()["detail"]


def test_list_polls_with_filtering(db_session):
    creator, c_token = create_test_user(db_session, "c_list")

    # Create standalone
    client.post("/api/v1/polls", json={
        "question": "Standalone filter test?",
        "options": ["Yes", "No"],
        "content_type": "standalone",
    }, headers={"Authorization": f"Bearer {c_token}"})

    list_all = client.get("/api/v1/polls", headers={"Authorization": f"Bearer {c_token}"})
    assert list_all.status_code == 200
    assert len(list_all.json()) >= 1

    list_standalone = client.get("/api/v1/polls?content_type=standalone", headers={"Authorization": f"Bearer {c_token}"})
    assert list_standalone.status_code == 200
    for p in list_standalone.json():
        assert p["content_type"] == "standalone"


def test_creator_sees_results_even_if_show_results_before_vote_false(db_session):
    creator, c_token = create_test_user(db_session, "c_vis")
    voter, v_token = create_test_user(db_session, "v_vis")

    res = client.post("/api/v1/polls", json={
        "question": "Creator sees tally?",
        "options": ["X", "Y"],
        "show_results_before_vote": False,
    }, headers={"Authorization": f"Bearer {c_token}"})
    poll = res.json()
    poll_id = poll["id"]
    opt_x = poll["options"][0]["id"]

    # Voter votes for X
    client.post(f"/api/v1/polls/{poll_id}/vote", json={"option_id": opt_x}, headers={"Authorization": f"Bearer {v_token}"})

    # Creator views poll (has NOT voted) -> Creator SHOULD see results
    creator_view = client.get(f"/api/v1/polls/{poll_id}", headers={"Authorization": f"Bearer {c_token}"})
    assert creator_view.status_code == 200
    c_data = creator_view.json()
    assert c_data["total_votes"] == 1
    assert c_data["options"][0]["vote_count"] == 1
    assert c_data["options"][0]["percentage"] == 100.0
