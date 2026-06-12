from flask import Blueprint, request, jsonify, g
from .database import db
from .models import User
from .security import hash_password, verify_password
from .auth import generate_token, verify_token
from .decorators import require_auth

bp = Blueprint("routes", __name__)

@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required!"}), 400
    
    existing_user = User.query.filter_by(email=data["email"]).first()

    if existing_user:
        return jsonify({"error": "Email is already registered!"}), 409
    
    new_user =  User(
        email = data["email"],
        password_hash = hash_password(data["password"]),
        name = data.get("name")
    )

    db.session.add(new_user)
    db.session.commit()

    token = generate_token(new_user.id)
    return jsonify({"token": token, "user": new_user.to_dict()}), 201

@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required!"}), 400
    
    user = User.query.filter_by(email = data["email"]).first()

    if not user or not verify_password(data["password"], user.password_hash):
        return jsonify({"error": "Invalid email or password"}), 401
    
    token = generate_token(user.id)
    return jsonify({"token": token, "user": user.to_dict()}), 200


@bp.route("/users/me", methods=["GET"])
@require_auth
def get_me():
    return jsonify({"user": g.current_user.to_dict()}), 200

@bp.route("/users/me", methods=["PATCH"])
@require_auth
def update_me():
   data = request.get_json()

   if not data:
    return jsonify({"error": "No data provided"}), 400
   
   user = g.current_user
   
   
   if "name" in data:
       user.name = data["name"]
   if "email" in data:
       existing = User.query.filter_by(email = data["email"]).first()

       if existing and existing.id != user.id:
        return jsonify({"error": "Email is already in use"}), 409
       
       user.email = data["email"]

   db.session.commit()
   return jsonify({"user": user.to_dict()}), 200