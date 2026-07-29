from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gmail_message_id = Column(String(255), unique=True, nullable=False, index=True)
    sender = Column(String(500), nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=True)
    image_urls = Column(Text, nullable=True)  # JSON array of image URLs found in the email
    received_date = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, default=_utcnow, nullable=False)

    # AI email-level verification
    email_verification_status = Column(String(20), nullable=True)   # "legitimate" | "suspicious" | "spam"
    email_verification_note = Column(Text, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)

    offers = relationship("Offer", back_populates="email", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Email id={self.id} subject={self.subject[:40]!r}>"


class Brand(Base):
    __tablename__ = "brands"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(255), unique=True, nullable=False, index=True)
    website      = Column(String(500), nullable=True)
    categories   = Column(Text, nullable=True)        # JSON array stored as text
    emails       = Column(Text, nullable=True)        # JSON array of known sender emails, stored as text
    is_active    = Column(Boolean, default=True, nullable=False)
    last_searched = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Brand id={self.id} name={self.name!r}>"


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=True)

    brand = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    subcategory = Column(String(255), nullable=True)
    offer_type = Column(String(255), nullable=True)
    discount_percentage = Column(Float, nullable=True)
    coupon_code = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    offer_value = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    key_highlights = Column(Text, nullable=True)   # JSON list stored as text
    website = Column(String(500), nullable=True)   # offer/brand URL
    is_active = Column(Boolean, default=True, nullable=False)
    source = Column(String(20), nullable=True)     # "email" | "ai"
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # AI verification fields
    verification_status = Column(String(20), nullable=True)      # "verified" | "suspicious" | "invalid"
    verification_reason = Column(Text, nullable=True)
    verification_confidence = Column(Float, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    email = relationship("Email", back_populates="offers")

    def __repr__(self) -> str:
        return f"<Offer id={self.id} brand={self.brand!r} discount={self.discount_percentage}%>"
