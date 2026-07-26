import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import frontmatter

from config import get_settings

settings = get_settings()
logger = logging.getLogger("agent-bot.memory")


class MemoryManager:
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or os.path.join(settings.log_path, "..", "memory"))
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.notes_index: Dict[str, Dict[str, Any]] = {}
        self._load_index()

    def _load_index(self) -> None:
        for md_file in self.base_path.rglob("*.md"):
            try:
                post = frontmatter.load(md_file)
                self.notes_index[str(md_file.relative_to(self.base_path))] = {
                    "title": post.get("title", md_file.stem),
                    "tags": post.get("tags", []),
                    "created": post.get("created"),
                    "updated": post.get("updated"),
                    "project": post.get("project"),
                    "user_id": post.get("user_id"),
                    "type": post.get("type", "note"),
                }
            except Exception as exc:
                logger.debug("Skip index for %s: %s", md_file, exc)

    def save_note(
        self,
        content: str,
        title: str = "Untitled",
        tags: Optional[List[str]] = None,
        project: Optional[str] = None,
        user_id: Optional[str] = None,
        note_type: str = "note",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        safe_title = "".join(c if c.isalnum() or c in "-_ " else "" for c in title).strip()
        filename = f"{datetime.utcnow().isoformat()}_{safe_title.replace(' ', '_')}.md"
        filepath = self.base_path / filename

        post = frontmatter.Post(content)
        post["title"] = title
        post["tags"] = tags or []
        post["project"] = project
        post["user_id"] = user_id
        post["type"] = note_type
        post["created"] = datetime.utcnow().isoformat()
        post["updated"] = datetime.utcnow().isoformat()
        if metadata:
            post["metadata"] = metadata

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(frontmatter.dumps(post))

        relative = str(filepath.relative_to(self.base_path))
        self.notes_index[relative] = {
            "title": title,
            "tags": tags or [],
            "created": post["created"],
            "updated": post["updated"],
            "project": project,
            "user_id": user_id,
            "type": note_type,
        }
        logger.debug("Saved memory note: %s", filename)
        return relative

    def search(
        self,
        query: str,
        project: Optional[str] = None,
        user_id: Optional[str] = None,
        note_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        query_lower = query.lower()

        for rel, meta in self.notes_index.items():
            if project and meta.get("project") != project:
                continue
            if user_id and meta.get("user_id") != user_id:
                continue
            if note_type and meta.get("type") != note_type:
                continue

            score = 0
            if query_lower in meta.get("title", "").lower():
                score += 3
            for tag in meta.get("tags", []):
                if query_lower in tag.lower():
                    score += 2

            if score > 0:
                results.append({**meta, "path": rel, "score": score})

        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:limit]

    def get_note(self, path: str) -> Optional[Dict[str, Any]]:
        filepath = self.base_path / path
        if not filepath.exists():
            return None
        try:
            post = frontmatter.load(filepath)
            return {
                "content": post.content,
                "metadata": dict(post.metadata),
                "path": path,
            }
        except Exception as exc:
            logger.error("Failed to read note %s: %s", path, exc)
            return None

    def list_notes(
        self,
        project: Optional[str] = None,
        user_id: Optional[str] = None,
        note_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        items = []
        for rel, meta in self.notes_index.items():
            if project and meta.get("project") != project:
                continue
            if user_id and meta.get("user_id") != user_id:
                continue
            if note_type and meta.get("type") != note_type:
                continue
            items.append({**meta, "path": rel})
        items.sort(key=lambda x: x.get("updated", ""), reverse=True)
        return items[:limit]

    def delete_note(self, path: str) -> bool:
        filepath = self.base_path / path
        if filepath.exists():
            filepath.unlink()
            self.notes_index.pop(path, None)
            return True
        return False


_memory_manager: Optional[MemoryManager] = None


def get_memory() -> MemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager
