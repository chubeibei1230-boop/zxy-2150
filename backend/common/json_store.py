import json
import os
import uuid
import threading
from typing import List, Dict, Any, Optional, Tuple


class JsonStore:
    _thread_lock = threading.Lock()

    def __init__(self, file_path: str, key_name: Optional[str] = None):
        self.file_path = file_path
        self.key_name = key_name
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        if not os.path.exists(self.file_path):
            os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
            with open(self.file_path, 'w', encoding='utf-8') as f:
                if self.key_name:
                    json.dump({self.key_name: []}, f, ensure_ascii=False, indent=2)
                else:
                    json.dump([], f, ensure_ascii=False, indent=2)

    def _acquire_lock(self) -> None:
        self._thread_lock.acquire()

    def _release_lock(self) -> None:
        self._thread_lock.release()

    def _read(self) -> List[Dict[str, Any]]:
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if self.key_name:
            return data.get(self.key_name, [])
        return data

    def _write(self, data: List[Dict[str, Any]]) -> None:
        with open(self.file_path, 'w', encoding='utf-8') as f:
            if self.key_name:
                json.dump({self.key_name: data}, f, ensure_ascii=False, indent=2)
            else:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        self._acquire_lock()
        try:
            items = self._read()
            new_item = data.copy()
            new_item['id'] = self._generate_id()
            items.append(new_item)
            self._write(items)
            return new_item
        finally:
            self._release_lock()

    def get_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        self._acquire_lock()
        try:
            items = self._read()
            for item in items:
                if item.get('id') == item_id:
                    return item
            return None
        finally:
            self._release_lock()

    def list(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        self._acquire_lock()
        try:
            items = self._read()
            if filters:
                items = [
                    item for item in items
                    if all(item.get(k) == v for k, v in filters.items())
                ]
            return items
        finally:
            self._release_lock()

    def paginate(
        self,
        page: int = 1,
        page_size: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: Optional[str] = None,
        sort_order: str = 'desc'
    ) -> Tuple[List[Dict[str, Any]], int, int]:
        self._acquire_lock()
        try:
            items = self._read()
            if filters:
                items = [
                    item for item in items
                    if all(item.get(k) == v for k, v in filters.items())
                ]
            if sort_by:
                reverse = sort_order == 'desc'
                items.sort(key=lambda x: x.get(sort_by, ''), reverse=reverse)
            total = len(items)
            start = (page - 1) * page_size
            end = start + page_size
            paginated_items = items[start:end]
            total_pages = (total + page_size - 1) // page_size
            return paginated_items, total, total_pages
        finally:
            self._release_lock()

    def update(self, item_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        self._acquire_lock()
        try:
            items = self._read()
            for i, item in enumerate(items):
                if item.get('id') == item_id:
                    updated_item = {**item, **data, 'id': item_id}
                    items[i] = updated_item
                    self._write(items)
                    return updated_item
            return None
        finally:
            self._release_lock()

    def delete(self, item_id: str) -> bool:
        self._acquire_lock()
        try:
            items = self._read()
            new_items = [item for item in items if item.get('id') != item_id]
            if len(new_items) == len(items):
                return False
            self._write(new_items)
            return True
        finally:
            self._release_lock()

    def soft_delete(self, item_id: str, data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        self._acquire_lock()
        try:
            items = self._read()
            for i, item in enumerate(items):
                if item.get('id') == item_id:
                    update_data = {'deleted': True}
                    if data:
                        update_data.update(data)
                    updated_item = {**item, **update_data, 'id': item_id}
                    items[i] = updated_item
                    self._write(items)
                    return updated_item
            return None
        finally:
            self._release_lock()

    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        self._acquire_lock()
        try:
            items = self._read()
            if filters:
                items = [
                    item for item in items
                    if all(item.get(k) == v for k, v in filters.items())
                ]
            return len(items)
        finally:
            self._release_lock()
