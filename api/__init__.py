from flask import Flask
from flask_cors import CORS

from config import logger
from database.db import init_db


def create_app() -> Flask:
    app = Flask(__name__)
    # Settings login uses an httpOnly session cookie, which requires a
    # concrete origin (not "*") plus supports_credentials — wildcard origins
    # and credentialed requests are mutually exclusive per browser CORS rules.
    # Every other endpoint in this app is still unauthenticated either way.
    CORS(
        app,
        resources={r"/api/*": {"origins": r"http://(localhost|127\.0\.0\.1):\d+"}},
        supports_credentials=True,
    )

    init_db()

    from services.job_registry import register_all
    register_all()

    from api.overview import bp as overview_bp
    app.register_blueprint(overview_bp)

    from api.insights import bp as insights_bp
    app.register_blueprint(insights_bp)

    from api.analytics import bp as analytics_bp
    app.register_blueprint(analytics_bp)

    from api.search import bp as search_bp
    app.register_blueprint(search_bp)

    from api.offers import bp as offers_bp
    app.register_blueprint(offers_bp)

    from api.brands import bp as brands_bp
    app.register_blueprint(brands_bp)

    from api.emails import bp as emails_bp
    app.register_blueprint(emails_bp)

    from api.unknown_emails import bp as unknown_emails_bp
    app.register_blueprint(unknown_emails_bp)

    from api.jobs import bp as jobs_bp
    app.register_blueprint(jobs_bp)

    from api.settings import bp as settings_bp
    app.register_blueprint(settings_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    logger.info("Flask API app created")
    return app
