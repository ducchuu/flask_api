import jwt
import uuid
from datetime import datetime, timedelta, timezone
from flask import current_app


def generate_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub" : str(user_id), 
        "iat" : int(now.timestamp()),
        "exp" : int((now + timedelta(hours=1)).timestamp()),
        "jti" : str(uuid.uuid4())
    }
    token = jwt.encode(payload, current_app.config["AUTH_KEY"], algorithm="HS256")
    return token

def verify_token(token: str) -> int:
    
    try: 
        payload = jwt.decode(token, current_app.config["AUTH_KEY"], algorithms=["HS256"])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        print("ExpiredTokenIsTheError")
        return None
    except jwt.InvalidTokenError as e:
        print(f"InvalidTokenIsTheError: {type(e).__name__}: {e}")
        return None
    except jwt.DecodeError:
        print("Decode Error")
        return None
    except jwt.InvalidAlgorithmError:
        print("InvalidAlgError")
        return None
