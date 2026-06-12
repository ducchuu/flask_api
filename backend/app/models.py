from .database import db
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(80), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    def __repr__(self):
        return f"<User {self.email}>"
    
    def to_dict(self):
        """Return a safe dictionary - password_hash is intentionally excluded."""

        return {
            "id" : self.id,
            "email" : self.email,
            "name" : self.name,
            "created_at" : self.created_at.isoformat()
        }