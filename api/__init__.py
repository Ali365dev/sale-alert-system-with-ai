from flask import Flask
from flask_cors import CORS

from config import logger
from database.db import init_db


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_db()

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

    from api.actions import bp as actions_bp
    app.register_blueprint(actions_bp)

    from api.jobs import bp as jobs_bp
    app.register_blueprint(jobs_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    logger.info("Flask API app created")
    return app
