"""Brand Discovery — admin-initiated brand search/website-scan feature.

Every module here is a small, independently testable service (crawler,
extractors, duplicate detector) — see services/brand_discovery/pipeline.py
for how they're wired together, and services/jobs/brand_discovery.py for the
BackgroundJob that runs the pipeline. No AI/LLM calls and no paid search API
anywhere in this package, by design — see that pipeline module's docstring.
"""
