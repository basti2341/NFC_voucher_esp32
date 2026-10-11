# Garmin Dashboard

Mini-Webseite mit Schritten, Kalorien, Ruhepuls, Schlaf und Aktivitäten aus Garmin Connect.

```bash
cd garmin_dashboard
pip install -r requirements.txt
python server.py        # fragt E-Mail/Passwort (oder GARMIN_EMAIL / GARMIN_PASSWORD setzen)
```

Dann http://localhost:8000 öffnen. Login-Tokens liegen in `~/.garminconnect`, Zugangsdaten werden nicht gespeichert.
Nutzt die inoffizielle Bibliothek `garminconnect`.
