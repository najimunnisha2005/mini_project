
from pathlib import Path
import uuid

import cv2
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

AI_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = AI_DIR.parent
UPLOAD_DIR = PROJECT_DIR / "uploads"
OUTPUT_DIR = PROJECT_DIR / "output"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="SENTRY-NET",
    description="Uploaded-video person detection, tracking and basic threat alerts",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/output",
    StaticFiles(directory=str(OUTPUT_DIR)),
    name="output",
)

model = None

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".webm"}
MAX_UPLOAD_SIZE = 500 * 1024 * 1024


def get_model():
    global model
    if model is None:
        model = YOLO("yolo11n.pt")
    return model


@app.get("/")
def home():
    return {
        "project": "SENTRY-NET",
        "message": "AI service is running",
        "health": "/health",
        "documentation": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "SENTRY-NET"}


@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload an MP4, AVI, MOV or WebM video.",
        )

    video_id = uuid.uuid4().hex
    input_path = UPLOAD_DIR / f"{video_id}{extension}"
    output_path = OUTPUT_DIR / f"{video_id}_analyzed.mp4"

    total_bytes = 0

    try:
        with input_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Video exceeds the 500 MB upload limit.",
                    )

                destination.write(chunk)

    except HTTPException:
        input_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        input_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Could not save uploaded video.",
        ) from exc
    finally:
        await file.close()

    capture = cv2.VideoCapture(str(input_path))

    if not capture.isOpened():
        input_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Could not open this video. Check that the file is valid.",
        )

    fps = capture.get(cv2.CAP_PROP_FPS)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if width <= 0 or height <= 0:
        capture.release()
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Invalid video dimensions.")

    fps = fps if fps > 0 else 25.0

    writer = cv2.VideoWriter(
        str(output_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )

    if not writer.isOpened():
        capture.release()
        input_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Could not create the processed video.",
        )

    frames_processed = 0
    max_people = 0
    total_person_detections = 0
    alerts = []

    try:
        detector = get_model()

        while True:
            success, frame = capture.read()
            if not success:
                break

            results = detector.track(
            frame,
            persist=True,
            classes=[0],
            verbose=False,
            )

            result = results[0]
            person_count = (
                len(result.boxes) if result.boxes is not None else 0
            )

            frames_processed += 1
            max_people = max(max_people, person_count)
            total_person_detections += person_count

            if person_count >= 5 and not any(
                alert["type"] == "CROWD" for alert in alerts
            ):
                alerts.append({
                    "type": "CROWD",
                    "severity": "MEDIUM",
                    "frame": frames_processed,
                    "description": (
                        f"At least 5 people detected in frame "
                        f"{frames_processed}."
                    ),
                })

            annotated_frame = result.plot()
            writer.write(annotated_frame)

    except Exception as exc:
        output_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Video analysis failed: {type(exc).__name__}: {exc}",
        ) from exc
    finally:
        capture.release()
        writer.release()

    if frames_processed == 0:
        output_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="The video has no readable frames.",
        )

    return {
        "project": "SENTRY-NET",
        "video_id": video_id,
        "original_filename": file.filename,
        "status": "completed",
        "frames_processed": frames_processed,
        "max_people_in_frame": max_people,
        "total_person_detections_across_frames": total_person_detections,
        "alerts": alerts,
        "analyzed_video": f"/output/{output_path.name}",
        "note": (
            "CROWD is a basic person-count threshold, not a verified threat. "
            "Running, loitering and intrusion detection are not implemented yet."
        ),
    }
