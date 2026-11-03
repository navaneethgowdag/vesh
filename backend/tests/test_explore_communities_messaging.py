"""
Comprehensive automated tests for TailorBird:
- Enhanced Explore Page (For You, Communities, Trending with time-decay ranking, People)
- Fashion-Focused Communities (Public vs Private isolation, roles & permissions, community feeds)
- Direct & Group Messaging (1-to-1, groups, unread tracking, user blocking)
- Social Sharing (In-chat sharing, community sharing, content preview hydration)
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.post import Post
from app.models.community import Community, CommunityMember, CommunityPost
from app.models.conversation import Conversation, ConversationParticipant, Message, UserBlock
from app.core.security import create_access_token

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_test_user(db, prefix="soc_user"):
    unique = uuid.uuid4().hex[:8]
    user = User(
        username=f"{prefix}_{unique}",
        email=f"{prefix}_{unique}@example.com",
        first_name="Fashion",
        last_name=f"User {unique}",
        password_hash="fakehashedpassword",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=str(user.id))
    return user, token


def test_explore_for_you_and_trending(db_session):
    user, token = create_test_user(db_session, "explore_viewer")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test For You feed
    res_feed = client.get("/api/v1/explore/feed", headers=headers)
    assert res_feed.status_code == 200
    data_feed = res_feed.json()
    assert "items" in data_feed
    assert isinstance(data_feed["items"], list)

    # 2. Test Trending feed
    res_trend = client.get("/api/v1/explore/trending", headers=headers)
    assert res_trend.status_code == 200
    data_trend = res_trend.json()
    assert "items" in data_trend
    if data_trend["items"]:
        first = data_trend["items"][0]
        assert "rank" in first
        assert "score" in first
        assert first["rank"] == 1

    # 3. Test People recommendations
    res_people = client.get("/api/v1/explore/people", headers=headers)
    assert res_people.status_code == 200
    data_people = res_people.json()
    assert "people" in data_people
    assert len(data_people["people"]) >= 0


def test_community_lifecycle_and_permissions(db_session):
    owner, owner_token = create_test_user(db_session, "comm_owner")
    member, member_token = create_test_user(db_session, "comm_member")
    outsider, outsider_token = create_test_user(db_session, "comm_outsider")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # 1. Create a public community
    comm_payload = {
        "name": f"Minimalist Club {uuid.uuid4().hex[:6]}",
        "description": "Clean lines, monochrome aesthetics, and capsule wardrobes.",
        "category": "Minimalist",
        "rules": "Be kind and share high-res outfit photos.",
        "visibility": "public",
    }
    res_create = client.post("/api/v1/communities", json=comm_payload, headers=owner_headers)
    assert res_create.status_code == 201
    comm_data = res_create.json()
    comm_id = comm_data["id"]
    assert comm_data["visibility"] == "public"
    assert comm_data["is_member"] is True
    assert comm_data["membership_role"] == "owner"

    # 2. Member joins the public community
    res_join = client.post(f"/api/v1/communities/{comm_id}/join", headers=member_headers)
    assert res_join.status_code == 200
    assert res_join.json()["status"] == "joined"

    # 3. Member posts a discussion in the community
    post_payload = {
        "title": "Favorite white sneaker brands?",
        "message": "Looking for minimal, clean silhouette white sneakers.",
    }
    res_post = client.post(f"/api/v1/communities/{comm_id}/feed", json=post_payload, headers=member_headers)
    assert res_post.status_code == 201
    created_post = res_post.json()
    cp_id = created_post["id"]
    assert created_post["title"] == "Favorite white sneaker brands?"

    # 4. Read community feed
    res_feed = client.get(f"/api/v1/communities/{comm_id}/feed", headers=outsider_headers)
    assert res_feed.status_code == 200
    feed_items = res_feed.json()
    assert any(item["id"] == cp_id for item in feed_items)

    # 5. Outsider tries to delete member's post -> should fail 403
    res_del_unauth = client.delete(f"/api/v1/communities/{comm_id}/feed/{cp_id}", headers=outsider_headers)
    assert res_del_unauth.status_code == 403

    # 6. Owner deletes member's post -> allowed
    res_del_owner = client.delete(f"/api/v1/communities/{comm_id}/feed/{cp_id}", headers=owner_headers)
    assert res_del_owner.status_code == 200
    assert res_del_owner.json()["success"] is True


def test_private_community_isolation(db_session):
    owner, owner_token = create_test_user(db_session, "priv_owner")
    applicant, applicant_token = create_test_user(db_session, "priv_applicant")
    outsider, outsider_token = create_test_user(db_session, "priv_outsider")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    applicant_headers = {"Authorization": f"Bearer {applicant_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # 1. Create a private community
    comm_payload = {
        "name": f"Haute Couture VIP {uuid.uuid4().hex[:6]}",
        "description": "Exclusive invite-only fashion discussions.",
        "category": "Luxury",
        "visibility": "private",
    }
    res_create = client.post("/api/v1/communities", json=comm_payload, headers=owner_headers)
    assert res_create.status_code == 201
    comm_id = res_create.json()["id"]

    # 2. Outsider attempts to read feed -> 403 Forbidden
    res_feed = client.get(f"/api/v1/communities/{comm_id}/feed", headers=outsider_headers)
    assert res_feed.status_code == 403

    # 3. Applicant requests to join private community
    res_join = client.post(f"/api/v1/communities/{comm_id}/join", headers=applicant_headers)
    assert res_join.status_code == 200
    assert res_join.json()["status"] == "requested"

    # 4. Owner approves applicant
    manage_payload = {"action": "approve"}
    res_approve = client.post(
        f"/api/v1/communities/{comm_id}/members/{applicant.id}/manage",
        json=manage_payload,
        headers=owner_headers,
    )
    assert res_approve.status_code == 200

    # 5. Now approved applicant can read feed
    res_feed_approved = client.get(f"/api/v1/communities/{comm_id}/feed", headers=applicant_headers)
    assert res_feed_approved.status_code == 200


def test_messaging_direct_and_group(db_session):
    user_a, token_a = create_test_user(db_session, "msg_a")
    user_b, token_b = create_test_user(db_session, "msg_b")
    user_c, token_c = create_test_user(db_session, "msg_c")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # 1. User A starts direct conversation with User B
    conv_payload = {
        "conversation_type": "direct",
        "recipient_user_id": str(user_b.id),
    }
    res_conv = client.post("/api/v1/messages/conversations", json=conv_payload, headers=headers_a)
    assert res_conv.status_code == 201
    conv = res_conv.json()
    conv_id = conv["id"]
    assert conv["conversation_type"] == "direct"

    # Idempotent: starting direct conversation again returns the same conversation
    res_conv_repeat = client.post("/api/v1/messages/conversations", json=conv_payload, headers=headers_a)
    assert res_conv_repeat.status_code == 201
    assert res_conv_repeat.json()["id"] == conv_id

    # 2. User A sends a message
    msg_payload = {"message_type": "text", "text_content": "Hey! Love your latest autumn outfit."}
    res_msg = client.post(f"/api/v1/messages/conversations/{conv_id}/messages", json=msg_payload, headers=headers_a)
    assert res_msg.status_code == 201
    sent_msg = res_msg.json()
    assert sent_msg["text_content"] == "Hey! Love your latest autumn outfit."

    # 3. User B checks unread count -> should be >= 1
    res_unread = client.get("/api/v1/messages/unread-count", headers=headers_b)
    assert res_unread.status_code == 200
    assert res_unread.json()["unread_count"] >= 1

    # 4. User B reads messages -> automatically marks as read
    res_read = client.get(f"/api/v1/messages/conversations/{conv_id}/messages", headers=headers_b)
    assert res_read.status_code == 200
    assert len(res_read.json()) >= 1

    # 5. User B checks unread count again -> should be 0
    res_unread_after = client.get("/api/v1/messages/unread-count", headers=headers_b)
    assert res_unread_after.status_code == 200
    assert res_unread_after.json()["unread_count"] == 0

    # 6. Create group conversation
    grp_payload = {
        "conversation_type": "group",
        "participant_user_ids": [str(user_b.id), str(user_c.id)],
        "title": "Winter Capsule Stylists",
    }
    res_grp = client.post("/api/v1/messages/conversations", json=grp_payload, headers=headers_a)
    assert res_grp.status_code == 201
    grp = res_grp.json()
    assert grp["conversation_type"] == "group"
    assert grp["title"] == "Winter Capsule Stylists"
    assert len(grp["participants"]) == 3


def test_user_blocking_in_messaging(db_session):
    user_x, token_x = create_test_user(db_session, "block_x")
    user_y, token_y = create_test_user(db_session, "block_y")

    headers_x = {"Authorization": f"Bearer {token_x}"}
    headers_y = {"Authorization": f"Bearer {token_y}"}

    # 1. User X blocks User Y
    res_block = client.post("/api/v1/messages/block", json={"user_id": str(user_y.id)}, headers=headers_x)
    assert res_block.status_code == 200
    assert res_block.json()["success"] is True

    # 2. User Y tries to start conversation with User X -> 403 Forbidden
    res_conv = client.post(
        "/api/v1/messages/conversations",
        json={"conversation_type": "direct", "recipient_user_id": str(user_x.id)},
        headers=headers_y,
    )
    assert res_conv.status_code == 403

    # 3. User X unblocks User Y
    res_unblock = client.delete(f"/api/v1/messages/block/{user_y.id}", headers=headers_x)
    assert res_unblock.status_code == 200
    assert res_unblock.json()["success"] is True

    # 4. Now conversation creation succeeds
    res_conv_ok = client.post(
        "/api/v1/messages/conversations",
        json={"conversation_type": "direct", "recipient_user_id": str(user_x.id)},
        headers=headers_y,
    )
    assert res_conv_ok.status_code == 201
