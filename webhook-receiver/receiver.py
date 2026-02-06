#!/usr/bin/env python3
"""
Kanbot Webhook Receiver (Docker version)
Forwards webhooks to host via mounted socket or writes to a file for the host to process.
"""

import json
import os
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)

# Write events to a shared volume that host can read
EVENTS_DIR = "/events"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    """Handle incoming webhook from Kanbot."""
    try:
        data = request.json
        event = data.get("event", "")
        space_id = data.get("space_id", "")
        payload = data.get("payload", {})
        
        card = payload.get("card", payload)
        card_id = card.get("id") or payload.get("card_id")
        # For delete events, card_name and start_date come directly in payload
        card_name = card.get("name") or payload.get("card_name", "")
        card_date = card.get("start_date") or payload.get("start_date", "")
        
        log(f"Received: event={event}, card_id={card_id}, card_name={card_name[:50] if card_name else 'N/A'}")
        
        if not card_id:
            return jsonify({"status": "skipped", "reason": "no card_id"}), 200
        
        # Write event to file for host to process
        event_data = {
            "timestamp": datetime.now().isoformat(),
            "event": event,
            "card_id": str(card_id),
            "card_name": card_name,
            "card_date": card_date,
            "space_id": space_id,
        }
        
        # For comment events, capture comment content and actor
        if event == "comment_created":
            event_data["comment_content"] = payload.get("content", "")[:200]
            event_data["actor_id"] = payload.get("actor_id", "")
            event_data["actor_name"] = payload.get("actor_name", "")
        
        os.makedirs(EVENTS_DIR, exist_ok=True)
        event_file = os.path.join(EVENTS_DIR, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{card_id[:8]}.json")
        
        with open(event_file, "w") as f:
            json.dump(event_data, f)
        
        log(f"Wrote event to {event_file}")
        
        return jsonify({"status": "ok", "event": event, "card_id": str(card_id)})
        
    except Exception as e:
        log(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

if __name__ == "__main__":
    log("Kanbot Webhook Receiver starting on 0.0.0.0:9999...")
    app.run(host="0.0.0.0", port=9999, debug=False)
