"""LLM provider abstraction with Gemini as the default backend."""

from functools import lru_cache

from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings


def llm_available() -> bool:
    return bool(settings.GEMINI_API_KEY)


@lru_cache
def get_chat_model() -> BaseChatModel:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.6,
    )
