from dataclasses import dataclass, replace

import cv2
import numpy as np


# Normalized tolerances are relative to the source width/height. A gap below
# 1% is treated as raster/Hough noise; larger gaps remain available as
# architectural opening evidence.
AXIS_PROXIMITY = 0.012
SMALL_GAP_TOLERANCE = 0.010
DUPLICATE_AXIS_TOLERANCE = 0.009
DUPLICATE_ENDPOINT_TOLERANCE = 0.014


@dataclass
class LineCandidate:
    x1: int
    y1: int
    x2: int
    y2: int
    length: float


@dataclass
class NormalizedLine:
    orientation: str
    axis: float
    start: float
    end: float
    thickness: float
    confidence: float


def decode(image: np.ndarray) -> np.ndarray:
    if image is None or image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("A decoded BGR image is required.")
    return image


def grayscale(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def normalize_contrast(gray: np.ndarray) -> np.ndarray:
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)


def threshold_image(normalized: np.ndarray) -> np.ndarray:
    return cv2.adaptiveThreshold(
        normalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 31, 9,
    )


def morphological_cleanup(binary: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def edge_map(cleaned: np.ndarray) -> np.ndarray:
    return cv2.Canny(cleaned, 50, 150)


def extract_contours(cleaned: np.ndarray) -> list[np.ndarray]:
    contours, _ = cv2.findContours(cleaned, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    return contours


def extract_lines(edges: np.ndarray) -> list[LineCandidate]:
    height, width = edges.shape
    min_length = max(24, int(min(width, height) * 0.07))
    raw = cv2.HoughLinesP(
        edges, 1, np.pi / 180,
        threshold=max(20, min_length // 2),
        minLineLength=min_length,
        maxLineGap=max(6, min_length // 6),
    )
    if raw is None:
        return []
    candidates: list[LineCandidate] = []
    for entry in raw[:, 0]:
        x1, y1, x2, y2 = (int(value) for value in entry)
        dx, dy = abs(x2 - x1), abs(y2 - y1)
        if min(dx, dy) > max(4, int(max(dx, dy) * 0.12)):
            continue
        candidates.append(LineCandidate(x1, y1, x2, y2, float(np.hypot(dx, dy))))
    candidates.sort(key=lambda item: item.length, reverse=True)
    return candidates[:200]


def normalize_wall_lines(image: np.ndarray) -> list[NormalizedLine]:
    """Extract thick horizontal/vertical ink runs as center lines.

    Dark-pixel morphology suppresses thin labels, door arcs, and colored window
    markers. Separate directional kernels keep intersections while producing a
    single center line instead of both Hough edges of each thick wall.
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    dark_ink = cv2.inRange(gray, 0, 95)
    min_run = max(22, int(min(width, height) * 0.035))
    min_thickness = max(5, int(min(width, height) * 0.007))
    outputs: list[NormalizedLine] = []

    for orientation, kernel in (
        ("horizontal", cv2.getStructuringElement(cv2.MORPH_RECT, (min_run, 1))),
        ("vertical", cv2.getStructuringElement(cv2.MORPH_RECT, (1, min_run))),
    ):
        directional = cv2.morphologyEx(dark_ink, cv2.MORPH_OPEN, kernel)
        count, _, stats, _ = cv2.connectedComponentsWithStats(directional, 8)
        for index in range(1, count):
            x, y, component_width, component_height, area = stats[index]
            if orientation == "horizontal":
                if component_width < min_run or component_height < min_thickness or component_width < component_height * 3:
                    continue
                outputs.append(NormalizedLine(
                    orientation="horizontal",
                    axis=(y + component_height / 2) / height,
                    start=x / width,
                    end=(x + component_width - 1) / width,
                    thickness=component_height / height,
                    confidence=min(0.94, 0.58 + area / max(1, component_width * component_height) * 0.32),
                ))
            else:
                if component_height < min_run or component_width < min_thickness or component_height < component_width * 3:
                    continue
                outputs.append(NormalizedLine(
                    orientation="vertical",
                    axis=(x + component_width / 2) / width,
                    start=y / height,
                    end=(y + component_height - 1) / height,
                    thickness=component_width / width,
                    confidence=min(0.94, 0.58 + area / max(1, component_width * component_height) * 0.32),
                ))
    return sorted(outputs, key=lambda line: (line.orientation, line.axis, line.start))


def _overlap(first: NormalizedLine, second: NormalizedLine) -> float:
    return min(first.end, second.end) - max(first.start, second.start)


def remove_duplicate_segments(lines: list[NormalizedLine]) -> list[NormalizedLine]:
    """Collapse nearly identical center lines while retaining the strongest evidence."""
    kept: list[NormalizedLine] = []
    for line in sorted(lines, key=lambda item: (-item.confidence, -(item.end - item.start))):
        duplicate_index = next((
            index for index, existing in enumerate(kept)
            if line.orientation == existing.orientation
            and abs(line.axis - existing.axis) <= DUPLICATE_AXIS_TOLERANCE
            and abs(line.start - existing.start) <= DUPLICATE_ENDPOINT_TOLERANCE
            and abs(line.end - existing.end) <= DUPLICATE_ENDPOINT_TOLERANCE
        ), None)
        if duplicate_index is None:
            kept.append(line)
        else:
            existing = kept[duplicate_index]
            total_weight = existing.confidence + line.confidence
            kept[duplicate_index] = replace(
                existing,
                axis=(existing.axis * existing.confidence + line.axis * line.confidence) / total_weight,
                thickness=max(existing.thickness, line.thickness),
                confidence=max(existing.confidence, line.confidence),
            )
    return sorted(kept, key=lambda item: (item.orientation, item.axis, item.start))


def merge_collinear_segments(
    lines: list[NormalizedLine],
    axis_tolerance: float = AXIS_PROXIMITY,
    gap_tolerance: float = SMALL_GAP_TOLERANCE,
) -> list[NormalizedLine]:
    """Merge compatible collinear segments but preserve larger opening gaps."""
    pending = remove_duplicate_segments(lines)
    changed = True
    while changed:
        changed = False
        result: list[NormalizedLine] = []
        consumed: set[int] = set()
        for index, line in enumerate(pending):
            if index in consumed:
                continue
            current = line
            for other_index in range(index + 1, len(pending)):
                if other_index in consumed:
                    continue
                other = pending[other_index]
                if current.orientation != other.orientation or abs(current.axis - other.axis) > axis_tolerance:
                    continue
                gap = max(current.start, other.start) - min(current.end, other.end)
                if gap > gap_tolerance:
                    continue
                first_length = current.end - current.start
                second_length = other.end - other.start
                weight = max(1e-6, first_length + second_length)
                current = NormalizedLine(
                    orientation=current.orientation,
                    axis=(current.axis * first_length + other.axis * second_length) / weight,
                    start=min(current.start, other.start),
                    end=max(current.end, other.end),
                    thickness=max(current.thickness, other.thickness),
                    confidence=max(current.confidence, other.confidence),
                )
                consumed.add(other_index)
                changed = True
            result.append(current)
        pending = sorted(result, key=lambda item: (item.orientation, item.axis, item.start))
    return remove_duplicate_segments(pending)
