FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/var/lib/ml-worker/huggingface \
    TRANSFORMERS_CACHE=/var/lib/ml-worker/huggingface

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./
RUN mkdir -p /var/lib/ml-worker/data /var/lib/ml-worker/huggingface

ENV ML_DATA_ROOT=/var/lib/ml-worker/data
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
