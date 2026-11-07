#!/usr/bin/env python3
"""
HumanoidTH Living Lab — robot telemetry client (Python 3.8+, standard library only).

Runs on the robot (or its companion computer). At the end of each interaction it
POSTs a signed log to /api/living-lab/telemetry, which links it to the session the
facilitator recorded on the same unit within ±30 minutes.

ROS 2: call `send_session_log(...)` from the node that ends an interaction behavior,
e.g. in the callback that handles your `/hri/interaction_end` topic.

Usage:
  export HUMANOIDTH_URL=https://your-fork.vercel.app
  export ROBOT_WEBHOOK_SECRET=...        # same value as the server
  export ROBOT_INVENTORY_ID=...          # the unit's id from /inventory
  python robot_telemetry_client.py --minutes 20 --interactions 34 --speech 21 --touch 3
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone


def send_session_log(base_url, secret, inventory_id, started_at, ended_at, interaction_count,
                     speech_turns=0, touch_events=0, error_count=0, emergency_stops=0,
                     firmware_version=None, session_id=None, timeout=10):
    payload = {
        "inventoryId": inventory_id,
        "startedAt": started_at.astimezone(timezone.utc).isoformat(),
        "endedAt": ended_at.astimezone(timezone.utc).isoformat(),
        "interactionCount": int(interaction_count),
        "speechTurns": int(speech_turns),
        "touchEvents": int(touch_events),
        "errorCount": int(error_count),
        "emergencyStops": int(emergency_stops),
    }
    if firmware_version:
        payload["firmwareVersion"] = firmware_version
    if session_id:
        payload["sessionId"] = session_id

    raw = json.dumps(payload, separators=(",", ":"))
    ts = str(int(time.time()))
    signature = hmac.new(secret.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        base_url.rstrip("/") + "/api/living-lab/telemetry",
        data=raw.encode(),
        method="POST",
        headers={"Content-Type": "application/json", "x-robot-timestamp": ts, "x-robot-signature": signature},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read().decode() or "{}")


def main():
    p = argparse.ArgumentParser(description="Send one signed interaction log to HumanoidTH Living Lab")
    p.add_argument("--minutes", type=float, required=True, help="interaction length, ending now")
    p.add_argument("--interactions", type=int, required=True)
    p.add_argument("--speech", type=int, default=0)
    p.add_argument("--touch", type=int, default=0)
    p.add_argument("--errors", type=int, default=0)
    p.add_argument("--estops", type=int, default=0)
    p.add_argument("--firmware")
    p.add_argument("--session-id")
    a = p.parse_args()

    missing = [k for k in ("HUMANOIDTH_URL", "ROBOT_WEBHOOK_SECRET", "ROBOT_INVENTORY_ID") if not os.environ.get(k)]
    if missing:
        sys.exit("Set environment variables: " + ", ".join(missing))

    end = datetime.now(timezone.utc)
    status, body = send_session_log(
        os.environ["HUMANOIDTH_URL"], os.environ["ROBOT_WEBHOOK_SECRET"], os.environ["ROBOT_INVENTORY_ID"],
        end - timedelta(minutes=a.minutes), end, a.interactions, a.speech, a.touch, a.errors, a.estops,
        a.firmware, a.session_id,
    )
    print(status, json.dumps(body, ensure_ascii=False))
    sys.exit(0 if status == 201 else 1)


if __name__ == "__main__":
    main()
