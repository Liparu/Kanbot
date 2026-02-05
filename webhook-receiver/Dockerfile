FROM python:3.11-slim

WORKDIR /app

RUN pip install flask

COPY receiver.py .

CMD ["python", "receiver.py"]
