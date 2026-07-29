"""Flask API entry point — serves the REST API consumed by the React frontend."""
from api import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False, threaded=True)
