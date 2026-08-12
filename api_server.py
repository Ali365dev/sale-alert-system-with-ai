"""Flask API entry point — serves the REST API consumed by the React frontend."""
import os

from api import create_app

app = create_app()

if __name__ == "__main__":
    if os.environ.get("FLASK_DEBUG") == "1":
        app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False, threaded=True)
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
        print("Serving on http://0.0.0.0:8000 (waitress, 8 threads). "
              "Set FLASK_DEBUG=1 to use the Flask dev server instead.")
        serve(app, host="0.0.0.0", port=8000, threads=8)
