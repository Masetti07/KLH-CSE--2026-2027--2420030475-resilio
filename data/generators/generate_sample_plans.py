"""Generate original deterministic floor-plan fixtures for ResilioSpace."""

from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT_DIR = Path(__file__).resolve().parent.parent
CANVAS = (960, 680)
WALL = 14


def base_plan() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", CANVAS, "#ffffff")
    return image, ImageDraw.Draw(image)


def wall(draw: ImageDraw.ImageDraw, points: tuple[int, int, int, int], width: int = WALL) -> None:
    draw.line(points, fill="#111827", width=width)


def door(draw: ImageDraw.ImageDraw, hinge: tuple[int, int], radius: int, direction: str) -> None:
    x, y = hinge
    if direction == "right":
        draw.line((x, y, x + radius, y), fill="white", width=WALL + 4)
        draw.arc((x - radius, y - radius, x + radius, y + radius), 270, 360, fill="#64748b", width=3)
        draw.line((x, y, x, y - radius), fill="#64748b", width=4)
    else:
        draw.line((x - radius, y, x, y), fill="white", width=WALL + 4)
        draw.arc((x - radius, y - radius, x + radius, y + radius), 180, 270, fill="#64748b", width=3)
        draw.line((x, y, x, y - radius), fill="#64748b", width=4)


def window(draw: ImageDraw.ImageDraw, segment: tuple[int, int, int, int]) -> None:
    draw.line(segment, fill="white", width=WALL + 4)
    draw.line(segment, fill="#38bdf8", width=5)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> None:
    draw.text(xy, text, fill="#475569")


def simple_1bed() -> Image.Image:
    image, draw = base_plan()
    draw.rectangle((110, 80, 850, 600), outline="#111827", width=WALL)
    wall(draw, (500, 80, 500, 600))
    wall(draw, (500, 360, 850, 360))
    door(draw, (500, 300), 62, "right")
    door(draw, (650, 600), 60, "left")
    window(draw, (220, 80, 360, 80))
    window(draw, (850, 175, 850, 285))
    label(draw, (250, 300), "LIVING")
    label(draw, (650, 220), "BEDROOM")
    label(draw, (650, 470), "KITCHEN")
    return image


def compact_2bed() -> Image.Image:
    image, draw = base_plan()
    draw.rectangle((80, 70, 880, 610), outline="#111827", width=WALL)
    wall(draw, (430, 70, 430, 610))
    wall(draw, (430, 335, 880, 335))
    wall(draw, (675, 335, 675, 610))
    door(draw, (430, 260), 58, "right")
    door(draw, (590, 335), 54, "left")
    door(draw, (770, 610), 54, "left")
    window(draw, (170, 70, 300, 70))
    window(draw, (520, 70, 620, 70))
    window(draw, (880, 415, 880, 500))
    label(draw, (220, 300), "LIVING")
    label(draw, (600, 195), "BEDROOM 1")
    label(draw, (500, 475), "KITCHEN")
    label(draw, (740, 475), "BEDROOM 2")
    return image


def family_house() -> Image.Image:
    image, draw = base_plan()
    draw.rectangle((55, 55, 905, 625), outline="#111827", width=WALL)
    wall(draw, (360, 55, 360, 625))
    wall(draw, (650, 55, 650, 625))
    wall(draw, (55, 330, 905, 330))
    wall(draw, (650, 475, 905, 475))
    for hinge, direction in [((360, 250), "right"), ((650, 255), "left"), ((280, 330), "left"), ((565, 330), "left"), ((760, 475), "right")]:
        door(draw, hinge, 52, direction)
    window(draw, (140, 55, 245, 55))
    window(draw, (445, 55, 550, 55))
    window(draw, (735, 55, 840, 55))
    window(draw, (55, 430, 55, 520))
    window(draw, (905, 375, 905, 445))
    for xy, text in [((165, 190), "LIVING"), ((450, 190), "BEDROOM 1"), ((735, 190), "BEDROOM 2"), ((150, 475), "DINING"), ((450, 475), "KITCHEN"), ((730, 405), "BATH"), ((730, 550), "UTILITY")]:
        label(draw, xy, text)
    return image


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    plans = {"sample_simple_1bed.png": simple_1bed(), "sample_compact_2bed.png": compact_2bed(), "sample_family_house.png": family_house()}
    for filename, image in plans.items():
        image.save(OUTPUT_DIR / filename, format="PNG", optimize=False)
        print(f"generated {filename} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
