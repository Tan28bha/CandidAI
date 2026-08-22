import redis
from app.core.config import settings

# Initialize redis connection client pool
# decode_responses=True automatically decodes values retrieved from Redis to string format
redis_client = redis.from_url(
    settings.REDIS_URL, 
    decode_responses=True,
    socket_timeout=5.0
)


def get_redis() -> redis.Redis:
    """
    Returns the initialized Redis client instance.
    """
    return redis_client


def verify_redis_connection() -> bool:
    """
    Pings Redis to check connectivity. Returns True if alive, False otherwise.
    """
    try:
        return redis_client.ping()
    except Exception:
        return False
