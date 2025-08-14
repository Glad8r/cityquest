from flask import Flask, request, jsonify
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import io
import base64

app = Flask(__name__)
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch16")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch16")

def get_embedding(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
    return image_features / image_features.norm(dim=-1, keepdim=True)

@app.route('/compare', methods=['POST'])
def compare_images():
    data = request.json
    img1_bytes = base64.b64decode(data['img1'].split(',')[1])
    img2_bytes = base64.b64decode(data['img2'].split(',')[1])
    emb1 = get_embedding(img1_bytes)
    emb2 = get_embedding(img2_bytes)
    similarity = torch.nn.functional.cosine_similarity(emb1, emb2).item()
    return jsonify({'similarity': similarity})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)