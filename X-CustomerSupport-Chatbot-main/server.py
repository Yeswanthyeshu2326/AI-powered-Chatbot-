import json
import mimetypes
import os
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


class ChatbotBackend:
    def __init__(self):
        self._chatbot = None
        self._lock = threading.Lock()

    def get_chatbot(self):
        if self._chatbot is not None:
            return self._chatbot

        with self._lock:
            if self._chatbot is not None:
                return self._chatbot

            try:
                from src.chatbot_with_langchain import XSupportChatbot

                index_path = ROOT / "models" / "faiss_index_flat.index"
                data_path = ROOT / "models" / "data_with_embeddings_ref.csv"

                if not index_path.exists() or not data_path.exists():
                    self._chatbot = None
                    return None

                self._chatbot = XSupportChatbot(
                    model_name="gpt-4",
                    prompt_template="expert",
                    temperature=0.7,
                    top_k=3,
                    use_memory=True,
                    index_path=str(index_path),
                    data_path=str(data_path),
                )
                return self._chatbot
            except Exception:
                self._chatbot = None
                return None

    def ask(self, message: str):
        chatbot = self.get_chatbot()
        if chatbot is None:
            return {
                "reply": "The chatbot backend is not ready yet. Make sure the model files and OPENAI_API_KEY are configured."
            }

        try:
            reply = chatbot.process_query(message)
            return {"reply": reply}
        except Exception as exc:
            return {"reply": f"Backend error: {exc}"}


backend = ChatbotBackend()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._send_json({"status": "ok"})
            return

        if path in ("/", "/index.html"):
            file_path = ROOT / "index.html"
        else:
            file_path = ROOT / path.lstrip("/")

        if file_path.exists() and file_path.is_file():
            self._serve_file(file_path)
        else:
            self._send_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/chat":
            self._send_json({"error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(body or "{}")
        except Exception:
            self._send_json({"error": "Invalid JSON"}, status=HTTPStatus.BAD_REQUEST)
            return

        message = payload.get("message", "").strip()
        if not message:
            self._send_json({"error": "Missing message"}, status=HTTPStatus.BAD_REQUEST)
            return

        result = backend.ask(message)
        self._send_json(result)

    def _serve_file(self, file_path: Path):
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type is None:
            mime_type = "application/octet-stream"

        content = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving frontend and API on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
