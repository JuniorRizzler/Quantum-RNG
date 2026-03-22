from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class FrameEntropySample:
    raw_frame: np.ndarray
    grayscale: np.ndarray
    mixed_pixels: np.ndarray
    lsb_bits: np.ndarray


class CameraEntropySource:
    """Collect entropy from a local camera sensor."""

    def __init__(self, camera_index: int = 0, width: int = 640, height: int = 480) -> None:
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.cap: cv2.VideoCapture | None = None
        self._previous_gray: np.ndarray | None = None

    def open(self) -> None:
        if self.cap is not None:
            return
        cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        if not cap.isOpened():
            raise RuntimeError("Could not open camera. Try another camera index or close apps using the webcam.")
        self.cap = cap

    def close(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def read_sample(self) -> FrameEntropySample:
        if self.cap is None:
            self.open()

        assert self.cap is not None
        ok, frame = self.cap.read()
        if not ok or frame is None:
            raise RuntimeError("Camera frame capture failed.")

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if self._previous_gray is None:
            self._previous_gray = gray

        # Mix consecutive frames to emphasize sensor-level changes.
        mixed = cv2.absdiff(gray, self._previous_gray)
        self._previous_gray = gray

        # Lowest bit is a simple entropy source candidate.
        lsb_bits = (mixed & 1).astype(np.uint8).reshape(-1)
        return FrameEntropySample(raw_frame=frame, grayscale=gray, mixed_pixels=mixed, lsb_bits=lsb_bits)

