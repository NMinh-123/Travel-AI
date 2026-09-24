# syntax=docker/dockerfile:1
#
# Sidecar embedding (BGE-M3). Xem claude_production.md, Bước 2.
#
# Model KHÔNG nằm trong image: BGE-M3 khoảng 2,2 GB, gói vào thì mỗi lần đẩy image lên registry
# phải kéo theo từng ấy. Nó được tải ở lần chạy đầu vào volume gắn ở HF_HOME, và giữ lại qua
# các lần cập nhật image.

# 3.11 khớp với venv đã chạy thật trên máy phát triển.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models
WORKDIR /app
COPY requirements.txt .
# torch bản CPU cài TRƯỚC, từ index riêng: bản mặc định trên PyPI cho Linux kéo theo CUDA, nặng
# thêm vài GB mà máy chủ không có GPU để dùng. Index CPU có sẵn wheel cho cả amd64 và aarch64.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd --system --uid 10001 app && mkdir -p /models && chown app /models
USER app
EXPOSE 8000
# start-period dài: lần chạy đầu phải tải model về volume. /ready chỉ trả 200 khi model đã nạp.
HEALTHCHECK --interval=30s --timeout=5s --start-period=900s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=4).status == 200 else 1)"
# uvicorn mặc định bind 127.0.0.1, tức là chỉ nghe trong chính container.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
