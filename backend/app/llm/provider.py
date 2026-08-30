"""LLM provider abstraction with Gemini as the default backend."""

from functools import lru_cache
from typing import Any, List, Optional
import json

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from app.core.config import settings


class MockChatModel(BaseChatModel):
    """
    Mock LLM provider to allow developer testing and verification 
    offline when no valid Gemini API key is configured.
    """
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        # Check if the prompt asks for JSON extraction (resume parser)
        prompt_text = "".join(getattr(msg, "content", "") for msg in messages)
        
        if "json" in prompt_text.lower() or "extract" in prompt_text.lower():
            content = json.dumps({
                "current_title": "Senior React Engineer",
                "years_of_experience": 6,
                "skills": ["React", "TypeScript", "Redux", "WebSockets", "Jest"],
                "bio": "Experienced frontend engineer specialized in building scalable SPAs with React, TypeScript and Redux."
            })
        else:
            content = (
                "Explain the difference between client-side rendering (CSR) "
                "and server-side rendering (SSR), and when you would choose each."
            )
            
        generation = ChatGeneration(message=AIMessage(content=content))
        return ChatResult(generations=[generation])

    def with_structured_output(self, schema: Any, **kwargs: Any) -> Any:
        class MockRunnable:
            def __init__(self, inner_schema: Any):
                self.schema = inner_schema

            def invoke(self, *args: Any, **kwargs: Any) -> Any:
                schema_name = getattr(self.schema, "__name__", "")
                if "Evaluation" in schema_name or "Result" in schema_name:
                    return self.schema(
                        score=4,
                        feedback="Mock feedback: Excellent description of React component rendering and hooks.",
                        probe_areas=["How do you handle memory leaks in useEffect?"]
                    )
                elif "Profile" in schema_name:
                    return self.schema(
                        current_title="Senior React Engineer",
                        bio="Experienced frontend engineer specialized in building scalable SPAs with React, TypeScript and Redux.",
                        location="Remote, US",
                        years_of_experience=6,
                        skills=["React", "TypeScript", "Redux", "WebSockets", "Jest"]
                    )
                # Generic fallback if schema is Pydantic model
                if hasattr(self.schema, "model_validate"):
                    try:
                        return self.schema()
                    except Exception:
                        pass
                return self.schema

        return MockRunnable(schema)

    @property
    def _llm_type(self) -> str:
        return "mock-chat-model"


def llm_available() -> bool:
    return True  # Mock LLM is always available as a fallback


@lru_cache
def get_chat_model() -> BaseChatModel:
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "dummy_key_for_now":
        return MockChatModel()
        
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.6,
    )
