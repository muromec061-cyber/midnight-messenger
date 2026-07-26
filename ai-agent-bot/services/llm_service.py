import asyncio
import json
import logging
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Any, AsyncIterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from config import get_settings

settings = get_settings()
logger = logging.getLogger("agent-bot.services.llm")


class LLMError(Exception):
    pass


class BaseLLMClient(ABC):
    @abstractmethod
    async def ainvoke(self, prompt: str, **kwargs: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    async def ainvoke_with_system(self, system: str, user: str, **kwargs: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    async def astream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        raise NotImplementedError

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        raise NotImplementedError


class OpenAIClient(BaseLLMClient):
    def __init__(self, api_key: str, base_url: str, model: str, embedding_model: str):
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise LLMError("openai package required for OpenAI provider")
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.embedding_model = embedding_model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def ainvoke(self, prompt: str, **kwargs: Any) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        return response.choices[0].message.content or ""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def ainvoke_with_system(self, system: str, user: str, **kwargs: Any) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            **kwargs,
        )
        return response.choices[0].message.content or ""

    async def astream(self, prompt: str, **kwargs: Any):
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            **kwargs,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def embed(self, text: str) -> list[float]:
        import asyncio
        return asyncio.run(self._aembed(text))

    async def _aembed(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        return response.data[0].embedding


class OllamaClient(BaseLLMClient):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def ainvoke(self, prompt: str, **kwargs: Any) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")

    async def ainvoke_with_system(self, system: str, user: str, **kwargs: Any) -> str:
        prompt = f"System: {system}\n\nUser: {user}\n\nAssistant:"
        return await self.ainvoke(prompt, **kwargs)

    async def astream(self, prompt: str, **kwargs: Any):
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt, "stream": True},
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def embed(self, text: str) -> list[float]:
        import asyncio
        return asyncio.run(self._aembed(text))

    async def _aembed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])


@lru_cache()
def get_llm_client() -> BaseLLMClient:
    provider = settings.llm_provider.lower()
    if provider == "openai":
        return OpenAIClient(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            embedding_model=settings.llm_embedding_model,
        )
    elif provider == "ollama":
        return OllamaClient(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
        )
    else:
        raise LLMError(f"Unsupported LLM provider: {provider}")
