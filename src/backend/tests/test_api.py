import io

from PIL import Image, ImageDraw


def image_bytes(format_name: str) -> bytes:
    image = Image.new("RGB", (320, 240), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 300, 220), outline="black", width=10)
    draw.line((160, 20, 160, 220), fill="black", width=8)
    output = io.BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_valid_png_upload_and_retrieval(client):
    response = client.post("/api/plans/upload", files={"file": ("plan.png", image_bytes("PNG"), "image/png")})
    assert response.status_code == 201
    payload = response.json()
    plan_id = payload["plan"]["id"]
    assert client.get(f"/api/plans/{plan_id}").status_code == 200
    structure = client.get(f"/api/plans/{plan_id}/structure")
    assert structure.status_code == 200
    assert structure.json()["id"] == plan_id
    artifact = client.get(f"/api/plans/{plan_id}/artifacts/threshold")
    assert artifact.status_code == 200
    assert artifact.headers["content-type"] == "image/png"


def test_valid_jpg_upload(client):
    response = client.post("/api/plans/upload", files={"file": ("plan.jpg", image_bytes("JPEG"), "image/jpeg")})
    assert response.status_code == 201
    assert response.json()["plan"]["media_type"] == "image/jpeg"


def test_invalid_extension_is_rejected(client):
    response = client.post("/api/plans/upload", files={"file": ("plan.gif", image_bytes("PNG"), "image/gif")})
    assert response.status_code == 400


def test_malformed_image_is_rejected(client):
    response = client.post("/api/plans/upload", files={"file": ("plan.png", b"not an image", "image/png")})
    assert response.status_code == 400


def test_content_must_match_extension(client):
    response = client.post("/api/plans/upload", files={"file": ("plan.png", image_bytes("JPEG"), "image/png")})
    assert response.status_code == 400
