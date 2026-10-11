"""Mini-Server: holt Garmin-Connect-Daten und liefert sie als JSON an index.html.

Start:  python server.py      ->  http://localhost:8000
Login:  GARMIN_EMAIL / GARMIN_PASSWORD als Umgebungsvariablen, sonst wird gefragt.
Tokens werden in ~/.garminconnect gespeichert (kein erneuter Login noetig).
"""
import json
import os
import sys
from datetime import date, timedelta
from getpass import getpass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from garminconnect import Garmin

HERE = Path(__file__).parent
TOKENS = os.path.expanduser("~/.garminconnect")
PORT = int(os.environ.get("PORT", 8000))


def login() -> Garmin:
    try:
        api = Garmin()
        api.login(TOKENS)
        return api
    except Exception:
        email = os.environ.get("GARMIN_EMAIL") or input("Garmin E-Mail: ")
        password = os.environ.get("GARMIN_PASSWORD") or getpass("Garmin Passwort: ")
        api = Garmin(email, password, prompt_mfa=lambda: input("MFA-Code: "))
        api.login()
        api.garth.dump(TOKENS)
        return api


def day_data(api: Garmin, d: date) -> dict:
    iso = d.isoformat()
    out = {"date": iso, "steps": None, "calories": None, "restingHr": None,
           "sleepHours": None, "sleep": None}
    try:
        s = api.get_user_summary(iso)
        out["steps"] = s.get("totalSteps")
        out["calories"] = s.get("totalKilocalories")
        out["restingHr"] = s.get("restingHeartRate")
    except Exception as e:
        print("summary", iso, e, file=sys.stderr)
    try:
        sl = (api.get_sleep_data(iso) or {}).get("dailySleepDTO") or {}
        total = sl.get("sleepTimeSeconds")
        if total:
            out["sleepHours"] = round(total / 3600, 2)
            out["sleep"] = {k: round((sl.get(f"{k}SleepSeconds") or 0) / 3600, 2)
                            for k in ("deep", "light", "rem", "awake")}
    except Exception as e:
        print("sleep", iso, e, file=sys.stderr)
    return out


def build(api: Garmin, days: int) -> dict:
    today = date.today()
    daily = [day_data(api, today - timedelta(days=i)) for i in range(days - 1, -1, -1)]
    acts = []
    for a in api.get_activities(0, 10):
        acts.append({
            "name": a.get("activityName"),
            "type": (a.get("activityType") or {}).get("typeKey"),
            "start": a.get("startTimeLocal"),
            "km": round((a.get("distance") or 0) / 1000, 2),
            "minutes": round((a.get("duration") or 0) / 60, 1),
            "avgHr": a.get("averageHR"),
            "calories": a.get("calories"),
        })
    return {"daily": daily, "activities": acts}


class Handler(BaseHTTPRequestHandler):
    api: Garmin = None

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/data":
            try:
                days = min(max(int(parse_qs(url.query).get("days", ["14"])[0]), 1), 60)
                body = json.dumps(build(self.api, days)).encode()
                self._send(200, "application/json", body)
            except Exception as e:
                self._send(500, "application/json", json.dumps({"error": str(e)}).encode())
        elif url.path in ("/", "/index.html"):
            self._send(200, "text/html; charset=utf-8", (HERE / "index.html").read_bytes())
        else:
            self._send(404, "text/plain", b"not found")

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    Handler.api = login()
    print(f"Laeuft auf http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
