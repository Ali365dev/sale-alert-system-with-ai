"""Flask API entry point — serves the REST API consumed by the React frontend."""
import os

from api import create_app

app = create_app()

# Render (and most PaaS hosts) assign the port dynamically via $PORT and route
# traffic to whatever the app actually binds — hardcoding 8000 would silently
# fail health checks there. Falls back to 8000 for local/Docker use, where
# nothing sets $PORT and 8000 is what docker-compose.yml/Dockerfile expect.
PORT = int(os.environ.get("PORT", 8000))

if __name__ == "__main__":
    if os.environ.get("FLASK_DEBUG") == "1":
        app.run(host="0.0.0.0", port=PORT, debug=True, use_reloader=False, threaded=True)
    else:
        from waitress import serve

        # A real production WSGI server instead of Werkzeug's dev server (which
        # even with threaded=True is single-process and GIL-bound for CPU work
        # like JSON-serializing large offer lists). Kept single-process with
        # multiple threads (not multi-process workers) on purpose: the in-process
        # background-job state (job_service, and the _bulk_search_state /
        # _single_search_state dicts in api/brands.py) is only visible within one
        # process — multiple worker processes would silently break status polling
        # for those unless that state were moved into the DB.
        print(f"Serving on http://0.0.0.0:{PORT} (waitress, 8 threads). "
              "Set FLASK_DEBUG=1 to use the Flask dev server instead.")
        serve(app, host="0.0.0.0", port=PORT, threads=8)
