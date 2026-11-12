# Wibowo TTS for the API (TTS_PROVIDER=wibowo). CPU only. tts-wibowo.py and requirements-wibowo.txt
# are copies of robot-display/; keep them identical.
FROM python:3.11-slim
RUN useradd --create-home tts
WORKDIR /app
# CPU-only PyTorch first, so pip does not pull the much larger CUDA build.
RUN pip install --no-cache-dir torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements-wibowo.txt .
RUN pip install --no-cache-dir -r requirements-wibowo.txt
COPY tts-wibowo.py .
ENV LOCALAPPDATA=/opt/wibowo
RUN mkdir -p /opt/wibowo && chown tts /opt/wibowo
USER tts
# Download the pinned source and checkpoint (checksums verified), then speak once so the build fails
# here, not at runtime, if anything is missing.
RUN python tts-wibowo.py --prepare \
 && python -c "import runpy; m=runpy.run_path('tts-wibowo.py', run_name='build'); a=m['load_voice']()('Tes suara AERO-BOT satu dua tiga.'); assert a[:4]==b'RIFF', 'no audio'; print('Wibowo OK', len(a), 'bytes')"
ENV AEROBOT_TTS_HOST=0.0.0.0
EXPOSE 4220
CMD ["python", "tts-wibowo.py"]
