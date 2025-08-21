from flask import Flask, request, jsonify
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import io
import base64
import os
import json
import time
from pathlib import Path
from datetime import datetime
import re

app = Flask(__name__)

from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}}, methods=["GET", "POST", "OPTIONS"])

# Leaderboard storage
LEADERBOARD_FILE = "leaderboard.json"

# Quest storage
QUESTS_DIR = "quests"

def load_leaderboard():
    """Load leaderboard data from file"""
    try:
        if os.path.exists(LEADERBOARD_FILE):
            with open(LEADERBOARD_FILE, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading leaderboard: {e}")
        return {}

def save_leaderboard(leaderboard_data):
    """Save leaderboard data to file"""
    try:
        with open(LEADERBOARD_FILE, 'w') as f:
            json.dump(leaderboard_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving leaderboard: {e}")
        return False

def ensure_quests_dir():
    """Create quests directory if it doesn't exist"""
    try:
        if not os.path.exists(QUESTS_DIR):
            os.makedirs(QUESTS_DIR)
            print(f"✅ Created {QUESTS_DIR} directory")
        return True
    except Exception as e:
        print(f"Error creating quests directory: {e}")
        return False

def save_quest_file(quest_data, quest_filepath):
    """Save quest file to specified path"""
    try:
        with open(quest_filepath, 'w', encoding='utf-8') as f:
            f.write(quest_data)
        print(f"✅ Quest file saved: {os.path.basename(quest_filepath)}")
        return True
    except Exception as e:
        print(f"Error saving quest file: {e}")
        return False

def save_quest_data(quest_data, data_filepath):
    """Save quest data (photos and metadata) to specified path"""
    try:
        with open(data_filepath, 'w', encoding='utf-8') as f:
            json.dump(quest_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Quest data saved: {os.path.basename(data_filepath)}")
        return True
    except Exception as e:
        print(f"Error saving quest data: {e}")
        return False

# Initialize model globally
model = None
processor = None

def initialize_model():
    """Initialize the CLIP model and processor"""
    global model, processor
    try:
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch16")
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch16")
        print("✅ CLIP model loaded successfully")
    except Exception as e:
        print(f"❌ Error loading CLIP model: {e}")
        raise

# Answer images are stored in the assets/beaverton/ directory
# The frontend now sends the filename directly

def get_embedding(image_bytes):
    """Generate CLIP embedding for an image"""
    if model is None or processor is None:
        raise RuntimeError("CLIP model not initialized")
    
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
        return image_features / image_features.norm(dim=-1, keepdim=True)
    except Exception as e:
        print(f"Error generating embedding: {e}")
        raise

def load_answer_image(filename):
    """Load answer image from server storage based on filename"""
    if not filename:
        raise ValueError("No filename provided")
    
    # Define quest folders to search in (dynamic from quests directory)
    quest_folders = []
    
    # Add quests directory to search paths
    if os.path.exists(QUESTS_DIR):
        for quest_folder in os.listdir(QUESTS_DIR):
            quest_path = os.path.join(QUESTS_DIR, quest_folder)
            if os.path.isdir(quest_path):
                quest_folders.append(quest_path)
    
    # Also include legacy asset folders for backward compatibility
    legacy_folders = ["assets/beaverton", "assets/aloha"]
    for folder in legacy_folders:
        if os.path.exists(folder):
            quest_folders.append(folder)
    
    # Try different possible paths for the image
    possible_paths = []
    
    # Add quest-specific paths
    for folder in quest_folders:
        possible_paths.extend([
            f"{folder}/{filename}",  # assets/quest/filename
            f"../{folder}/{filename}",  # One level up
            f"../../{folder}/{filename}",  # Two levels up
            f"src/{folder}/{filename}",  # In src directory
            f"../src/{folder}/{filename}",  # One level up from src
        ])
    
    # Add fallback paths
    possible_paths.extend([
        filename,  # Just the filename (fallback)
        f"assets/{filename}",  # Direct in assets
        f"../assets/{filename}",  # One level up in assets
    ])
    
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, 'rb') as f:
                    print(f"✅ Found image at: {path}")
                    return f.read()
            except Exception as e:
                print(f"Error reading file {path}: {e}")
                continue
    
    raise FileNotFoundError(f"Answer image '{filename}' not found at any of the expected paths")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'processor_loaded': processor is not None
    })

@app.route('/compare', methods=['POST'])
def compare_images():
    """Compare player image with server-stored answer image"""
    try:
        with torch.no_grad():
            data = request.json
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            # New API format: playerImage and answerImage (supports single image or array of images)
            if 'playerImage' in data and 'answerImage' in data:
                # Decode player's image
                player_image_data = data['playerImage']
                if player_image_data.startswith('data:image'):
                    player_image_data = player_image_data.split(',')[1]
                
                try:
                    player_img_bytes = base64.b64decode(player_image_data)
                except Exception as e:
                    return jsonify({'error': f'Invalid base64 image data: {e}'}), 400
                
                # Get answer image(s) - can be single filename or array of filenames
                answer_images = data['answerImage']
                
                # Convert single image to array for consistent processing
                if isinstance(answer_images, str):
                    answer_images = [answer_images]
                elif not isinstance(answer_images, list):
                    return jsonify({'error': 'answerImage must be a string or array of strings'}), 400
                
                # Get player embedding once
                try:
                    player_emb = get_embedding(player_img_bytes)
                except Exception as e:
                    return jsonify({'error': f'Error processing player image: {e}'}), 500
                
                # Compare with all answer images and find the highest similarity
                max_similarity = -1.0
                best_match = None
                
                for answer_image_filename in answer_images:
                    try:
                        # Load answer image from server storage
                        answer_img_bytes = load_answer_image(answer_image_filename)
                        
                        # Get embedding for answer image
                        answer_emb = get_embedding(answer_img_bytes)
                        
                        # Calculate similarity
                        similarity = torch.nn.functional.cosine_similarity(player_emb, answer_emb).item()
                        
                        # Track the highest similarity
                        if similarity > max_similarity:
                            max_similarity = similarity
                            best_match = answer_image_filename
                            
                        print(f"Similarity with {answer_image_filename}: {similarity}")
                        
                    except (ValueError, FileNotFoundError) as e:
                        print(f"Warning: Could not load answer image {answer_image_filename}: {e}")
                        continue
                    except Exception as e:
                        print(f"Error processing answer image {answer_image_filename}: {e}")
                        continue
                
                if max_similarity == -1.0:
                    return jsonify({'error': 'Could not load any answer images'}), 400
                
                print(f"Best match: {best_match} with similarity: {max_similarity}")
                return jsonify({'similarity': max_similarity})
            
            # Legacy API format: img1 and img2 (for backward compatibility)
            elif 'img1' in data and 'img2' in data:
                try:
                    img1_bytes = base64.b64decode(data['img1'].split(',')[1])
                    img2_bytes = base64.b64decode(data['img2'].split(',')[1])
                except Exception as e:
                    return jsonify({'error': f'Invalid base64 image data: {e}'}), 400
                
                try:
                    emb1 = get_embedding(img1_bytes)
                    emb2 = get_embedding(img2_bytes)
                except Exception as e:
                    return jsonify({'error': f'Error processing images: {e}'}), 500
                
                similarity = torch.nn.functional.cosine_similarity(emb1, emb2).item()
                return jsonify({'similarity': similarity})
            
            else:
                return jsonify({'error': 'Invalid request format. Expected playerImage and answerImage (string or array), or img1 and img2'}), 400
                
    except Exception as e:
        print(f"Unexpected error in compare_images: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/leaderboard/<quest_id>/get', methods=['POST', 'OPTIONS'])
def get_leaderboard(quest_id):
    """Get leaderboard for a specific quest"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        leaderboard_data = load_leaderboard()
        quest_leaderboard = leaderboard_data.get(str(quest_id), [])
        
        # Sort by waypoints completed (descending), then by completion time (ascending)
        sorted_leaderboard = sorted(
            quest_leaderboard,
            key=lambda x: (-x.get('waypoints_completed', 0), x.get('completion_time', float('inf')))
        )
        
        return jsonify({
            'quest_id': quest_id,
            'leaderboard': sorted_leaderboard
        })
    except Exception as e:
        print(f"Error getting leaderboard: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/leaderboard/<quest_id>/add', methods=['POST', 'OPTIONS'])
def add_leaderboard_entry(quest_id):
    """Add a new leaderboard entry for a quest"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['team_name', 'waypoints_completed', 'completion_time', 'quest_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        leaderboard_data = load_leaderboard()
        
        # Initialize quest leaderboard if it doesn't exist
        if str(quest_id) not in leaderboard_data:
            leaderboard_data[str(quest_id)] = []
        
        # Create new entry
        new_entry = {
            'team_name': data['team_name'],
            'waypoints_completed': data['waypoints_completed'],
            'completion_time': data['completion_time'],
            'quest_date': data['quest_date'],
            'timestamp': datetime.now().isoformat()
        }
        
        # Add to leaderboard
        leaderboard_data[str(quest_id)].append(new_entry)
        
        # Save updated leaderboard
        if save_leaderboard(leaderboard_data):
            return jsonify({'message': 'Leaderboard entry added successfully'})
        else:
            return jsonify({'error': 'Failed to save leaderboard'}), 500
            
    except Exception as e:
        print(f"Error adding leaderboard entry: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/submit-quest', methods=['POST', 'OPTIONS'])
def submit_quest():
    """Submit a new quest with photos and metadata"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        # Ensure quests directory exists
        if not ensure_quests_dir():
            return jsonify({'error': 'Failed to create quests directory'}), 500
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        print(f"Received data: {type(data)}")
        print(f"Data keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
        
        quest_data = data.get('questData')
        zip_data = data.get('zipData')
        
        print(f"Quest data type: {type(quest_data)}")
        print(f"Zip data type: {type(zip_data)}")
        
        if isinstance(zip_data, str):
            try:
                zip_data = json.loads(zip_data)
                print("Successfully parsed zip_data from JSON string")
            except json.JSONDecodeError as e:
                print(f"Failed to parse zip_data JSON: {e}")
                return jsonify({'error': 'Invalid zip_data format'}), 400
        
        if not quest_data or not quest_data.get('name'):
            return jsonify({'error': 'Quest data is required'}), 400
        
        # Validate that each waypoint has at least one photo
        for i, cp in enumerate(quest_data.get('checkpoints', [])):
            if cp.get('lat') and cp.get('lng'):
                waypoint_photos = zip_data.get('photos', {}).get(str(i), {})
                if not isinstance(waypoint_photos, dict):
                    print(f"Warning: waypoint_photos for waypoint {i} is not a dict: {type(waypoint_photos)}")
                    waypoint_photos = {}
                photo_count = len([p for p in waypoint_photos.values() if p and isinstance(p, dict) and p.get('data')])
                if photo_count == 0:
                    return jsonify({'error': f'Waypoint {i+1} must have at least one photo'}), 400
        
        # Create a safe quest folder name
        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', quest_data['name'])
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        quest_folder = f"{safe_name}_{timestamp}"
        quest_folder_path = os.path.join(QUESTS_DIR, quest_folder)
        quest_filename = f"{safe_name}_{timestamp}.json"
        
        # Create quest folder
        try:
            os.makedirs(quest_folder_path, exist_ok=True)
            print(f"✅ Created quest folder: {quest_folder}")
        except Exception as e:
            print(f"Error creating quest folder: {e}")
            return jsonify({'error': 'Failed to create quest folder'}), 500
        
        # Process photos and save them as JPEG files
        saved_images = []
        waypoints_with_photos = []
        
        for i, cp in enumerate(quest_data.get('checkpoints', [])):
            if cp.get('lat') and cp.get('lng'):
                waypoint_images = []
                
                # Get photos for this waypoint from zip_data
                waypoint_photos = zip_data.get('photos', {}).get(str(i), {})
                if not isinstance(waypoint_photos, dict):
                    print(f"Warning: waypoint_photos for waypoint {i} is not a dict: {type(waypoint_photos)}")
                    waypoint_photos = {}
                
                for photo_index, photo_data in waypoint_photos.items():
                    if photo_data and isinstance(photo_data, dict) and photo_data.get('data'):
                        # Extract base64 image data
                        image_data = photo_data['data']
                        if image_data.startswith('data:image'):
                            image_data = image_data.split(',')[1]
                        
                        try:
                            # Decode base64 and save as JPEG
                            image_bytes = base64.b64decode(image_data)
                            image_filename = f"{safe_name}_{timestamp}_waypoint{i+1}_photo{int(photo_index)+1}.jpg"
                            
                            # Save image file
                            image_filepath = os.path.join(quest_folder_path, image_filename)
                            with open(image_filepath, 'wb') as f:
                                f.write(image_bytes)
                            
                            waypoint_images.append(image_filename)
                            saved_images.append(image_filename)
                            print(f"✅ Saved image: {image_filename}")
                            
                        except Exception as e:
                            print(f"Error saving image for waypoint {i+1}, photo {photo_index}: {e}")
                            continue  # Skip this image but continue with others
                
                waypoints_with_photos.append({
                    'id': i + 1,  # Sequential waypoint number
                    'name': cp.get('name', f'Waypoint {i+1}'),
                    'clue': cp.get('clue', f'Find waypoint {i+1}'),
                    'lat': cp.get('lat', 0),
                    'lng': cp.get('lng', 0),
                    'notes': cp.get('notes', ''),
                    'answerImage': waypoint_images if waypoint_images else []  # Include all images as an array
                })
        
        # Generate the quest file content as JSON
        quest_json_data = {
            'id': quest_data.get('id', int(time.time() * 1000)), # Use provided ID or generate timestamp
            'name': quest_data['name'],
            'description': quest_data.get('description', 'Quest created with Quest Creator'),
            'difficulty': 'Medium',
            'ageGroup': 'All Ages',
            'distance': f'{len(waypoints_with_photos)} waypoints',
            'checkpoints': [
                {
                    'id': wp['id'],
                    'name': wp['name'],
                    'clue': wp['clue'],
                    'lat': wp['lat'],
                    'lng': wp['lng'],
                    'notes': wp['notes'] if wp['notes'] else '',
                    'answerImage': wp['answerImage'] if wp['answerImage'] else []
                }
                for wp in waypoints_with_photos
            ]
        }
        
        quest_file_content = json.dumps(quest_json_data, indent=2)
        
        # Save the quest file
        quest_filepath = os.path.join(quest_folder_path, quest_filename)
        if not save_quest_file(quest_file_content, quest_filepath):
            return jsonify({'error': 'Failed to save quest file'}), 500
        

        
        print(f"🎉 Quest submitted successfully: {quest_filename}")
        print(f"📸 Saved {len(saved_images)} images")
        
        return jsonify({
            'success': True,
            'message': 'Quest submitted successfully',
            'questFile': quest_filename,
            'savedImages': saved_images,
            'waypointsCount': len(waypoints_with_photos)
        })
        
    except Exception as e:
        print(f"Error submitting quest: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/quests', methods=['GET', 'OPTIONS'])
def get_all_quests():
    """Get a list of all available quests"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        if not ensure_quests_dir():
            return jsonify({'error': 'Failed to create quests directory'}), 500
        
        quests = []
        if os.path.exists(QUESTS_DIR):
            for quest_folder in os.listdir(QUESTS_DIR):
                quest_path = os.path.join(QUESTS_DIR, quest_folder)
                
                # Check if it's a directory
                if os.path.isdir(quest_path):
                    # Look for .json files in the quest folder (preferred) or .js files (fallback)
                    # Exclude metadata files
                    json_files = [f for f in os.listdir(quest_path) if f.endswith('.json') and not f.endswith('_metadata.json')]
                    js_files = [f for f in os.listdir(quest_path) if f.endswith('.js')]
                    
                    # Use JSON files if available, otherwise fall back to JS files
                    quest_files = json_files if json_files else js_files
                    
                    for quest_file in quest_files:
                        try:
                            filepath = os.path.join(quest_path, quest_file)
                            is_json = quest_file.endswith('.json')
                            
                            if is_json:
                                # Load JSON file directly
                                with open(filepath, 'r', encoding='utf-8') as f:
                                    quest_data = json.load(f)
                                
                                # Extract quest info from JSON
                                quest_id = quest_data.get('id', len(quests) + 1)
                                quest_id_str = str(quest_id) if isinstance(quest_id, int) else quest_id
                                waypoint_count = len(quest_data.get('checkpoints', []))
                                
                                quests.append({
                                    'id': len(quests) + 1,  # Sequential ID for the list
                                    'id_string': quest_id_str,
                                    'name': quest_data.get('name', ''),
                                    'description': quest_data.get('description', ''),
                                    'difficulty': quest_data.get('difficulty', 'Medium'),
                                    'ageGroup': quest_data.get('ageGroup', 'All Ages'),
                                    'distance': quest_data.get('distance', 'Unknown'),
                                    'waypoints': waypoint_count,
                                    'folder': quest_folder,
                                    'filename': quest_file,
                                    'rating': quest_data.get('rating', 0),
                                    'enabled': quest_data.get('enabled', True)
                                })
                            else:
                                # Handle JS files (legacy support)
                                with open(filepath, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                
                                # Extract quest info from the file content
                                name_match = re.search(r"name: '([^']+)'", content)
                                description_match = re.search(r"description: '([^']+)'", content)
                                difficulty_match = re.search(r"difficulty: '([^']+)'", content)
                                age_group_match = re.search(r"ageGroup: '([^']+)'", content)
                                distance_match = re.search(r"distance: '([^']+)'", content)
                                
                                # Try to extract ID - support both numeric and string IDs
                                id_match = re.search(r"id: '([^']+)'", content)  # String ID
                                if not id_match:
                                    id_match = re.search(r"id: ([0-9]+)", content)  # Numeric ID
                                
                                if name_match:
                                    # Count waypoints by looking for checkpoint entries
                                    waypoint_count = len(re.findall(r"id: [0-9]+", content)) - 1  # Subtract 1 for quest id
                                    
                                    # Generate a numeric ID for the quest list
                                    quest_id = len(quests) + 1
                                    if id_match:
                                        # Use the original ID as a string identifier
                                        quest_id_str = id_match.group(1)
                                    else:
                                        quest_id_str = f"quest_{quest_id}"
                                    
                                    quests.append({
                                        'id': quest_id,
                                        'id_string': quest_id_str,
                                        'name': name_match.group(1),
                                        'description': description_match.group(1) if description_match else '',
                                        'difficulty': difficulty_match.group(1) if difficulty_match else 'Medium',
                                        'ageGroup': age_group_match.group(1) if age_group_match else 'All Ages',
                                        'distance': distance_match.group(1) if distance_match else 'Unknown',
                                        'waypoints': waypoint_count,
                                        'folder': quest_folder,
                                        'filename': quest_file,
                                        'rating': 0,  # JS files don't have ratings yet
                                        'enabled': True
                                    })
                        except Exception as e:
                            print(f"Error reading quest file {js_file} in {quest_folder}: {e}")
                            continue
        
        # Sort quests by ID
        quests.sort(key=lambda x: x['id'])
        return jsonify(quests)
        
    except Exception as e:
        print(f"Error getting quests: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/quests/<quest_id>', methods=['GET', 'OPTIONS'])
def get_quest_by_id(quest_id):
    """Get a specific quest by ID"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        if not ensure_quests_dir():
            return jsonify({'error': 'Failed to create quests directory'}), 500
        
        print(f"🔍 Looking for quest with ID: {quest_id}")
        print(f"📁 QUESTS_DIR: {QUESTS_DIR}")
        print(f"📁 QUESTS_DIR exists: {os.path.exists(QUESTS_DIR)}")
        
        if os.path.exists(QUESTS_DIR):
            quest_folders = os.listdir(QUESTS_DIR)
            print(f"📁 Found quest folders: {quest_folders}")
            
            for quest_folder in quest_folders:
                quest_path = os.path.join(QUESTS_DIR, quest_folder)
                
                # Check if it's a directory
                if os.path.isdir(quest_path):
                    # Look for .json files in the quest folder (preferred) or .js files (fallback)
                    # Exclude metadata files
                    json_files = [f for f in os.listdir(quest_path) if f.endswith('.json') and not f.endswith('_metadata.json')]
                    js_files = [f for f in os.listdir(quest_path) if f.endswith('.js')]
                    
                    # Use JSON files if available, otherwise fall back to JS files
                    quest_files = json_files if json_files else js_files
                    
                    for quest_file in quest_files:
                        try:
                            filepath = os.path.join(quest_path, quest_file)
                            is_json = quest_file.endswith('.json')
                            
                            if is_json:
                                # Load JSON file directly
                                with open(filepath, 'r', encoding='utf-8') as f:
                                    quest_data = json.load(f)
                                
                                # Check if this quest matches the requested ID
                                quest_id_from_file = quest_data.get('id')
                                quest_found = False
                                
                                if quest_id_from_file:
                                    quest_id_str = str(quest_id_from_file)
                                    print(f"🔍 Comparing JSON quest_id_str='{quest_id_str}' with requested quest_id='{quest_id}'")
                                    # Try to match by string ID or numeric ID
                                    if quest_id.isdigit():
                                        # Requested ID is numeric
                                        quest_found = (quest_id_str == quest_id or quest_id_str == f"quest_{quest_id}")
                                        print(f"  Numeric comparison: quest_found={quest_found}")
                                    else:
                                        # Requested ID is string
                                        quest_found = (quest_id_str == quest_id)
                                        print(f"  String comparison: quest_found={quest_found}")
                                else:
                                    print(f"❌ No ID found in JSON quest file {quest_file}")
                                
                                if quest_found:
                                    # Found the quest, return the JSON data
                                    return jsonify({
                                        'id': quest_id,
                                        'content': json.dumps(quest_data, indent=2),
                                        'folder': quest_folder,
                                        'filename': quest_file
                                    })
                            else:
                                # Handle JS files (legacy support)
                                with open(filepath, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                
                                # Extract quest info from the file content
                                # Try to extract ID - support both numeric and string IDs
                                id_match = re.search(r"id: '([^']+)'", content)  # String ID
                                if not id_match:
                                    id_match = re.search(r"id: ([0-9]+)", content)  # Numeric ID
                                
                                # Check if this quest matches the requested ID
                                quest_found = False
                                if id_match:
                                    quest_id_str = id_match.group(1)
                                    print(f"🔍 Comparing JS quest_id_str='{quest_id_str}' with requested quest_id='{quest_id}'")
                                    # Try to match by string ID or numeric ID
                                    if quest_id.isdigit():
                                        # Requested ID is numeric
                                        quest_found = (quest_id_str == quest_id or quest_id_str == f"quest_{quest_id}")
                                        print(f"  Numeric comparison: quest_found={quest_found}")
                                    else:
                                        # Requested ID is string
                                        quest_found = (quest_id_str == quest_id)
                                        print(f"  String comparison: quest_found={quest_found}")
                                else:
                                    print(f"❌ No ID found in JS quest file {quest_file}")
                                
                                if quest_found:
                                    # Found the quest, return the full content
                                    return jsonify({
                                        'id': quest_id,
                                        'content': content,
                                        'folder': quest_folder,
                                        'filename': quest_file
                                    })
                        except Exception as e:
                            print(f"Error reading quest file {quest_file} in {quest_folder}: {e}")
                            continue
        
        return jsonify({'error': 'Quest not found'}), 404
        
    except Exception as e:
        print(f"Error getting quest {quest_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/quest/<quest_id>/rate', methods=['POST', 'OPTIONS'])
def rate_quest(quest_id):
    """Rate a quest (1-5 stars) and update the average rating"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.json
        if not data or 'rating' not in data:
            return jsonify({'error': 'Rating is required'}), 400
        
        rating = data['rating']
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be an integer between 1 and 5'}), 400
        
        print(f"⭐ Rating quest {quest_id} with {rating} stars")
        
        # Find the quest file by checking the ID in the JSON content
        quest_file_path = None
        if os.path.exists(QUESTS_DIR):
            for quest_folder in os.listdir(QUESTS_DIR):
                quest_path = os.path.join(QUESTS_DIR, quest_folder)
                if os.path.isdir(quest_path):
                    # Look for JSON files
                    json_files = [f for f in os.listdir(quest_path) if f.endswith('.json')]
                    for json_file in json_files:
                        file_path = os.path.join(quest_path, json_file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                quest_data = json.load(f)
                                # Check if the quest ID matches
                                if str(quest_data.get('id')) == str(quest_id):
                                    quest_file_path = file_path
                                    break
                        except Exception as e:
                            print(f"Error reading quest file {json_file}: {e}")
                            continue
                    if quest_file_path:
                        break
        
        if not quest_file_path or not os.path.exists(quest_file_path):
            return jsonify({'error': 'Quest not found'}), 404
        
        # Load the quest data
        with open(quest_file_path, 'r', encoding='utf-8') as f:
            quest_data = json.load(f)
        
        # Get or create leaderboard data
        leaderboard_data = quest_data.get('leaderboard', {})
        if not leaderboard_data:
            leaderboard_data = {
                'entries': [],
                'stats': {
                    'total_completions': 0,
                    'average_time': 0,
                    'best_time': None,
                    'last_updated': None
                }
            }
        
        # Get or create ratings array
        ratings = leaderboard_data.get('ratings', [])
        if not ratings:
            ratings = []
        
        # Add the new rating
        ratings.append({
            'rating': rating,
            'timestamp': datetime.now().isoformat()
        })
        
        # Calculate new average rating
        if ratings:
            total_rating = sum(r['rating'] for r in ratings)
            average_rating = round(total_rating / len(ratings), 1)
        else:
            average_rating = 0
        
        # Update the quest data
        leaderboard_data['ratings'] = ratings
        quest_data['leaderboard'] = leaderboard_data
        quest_data['rating'] = average_rating
        
        # Save the updated quest file
        with open(quest_file_path, 'w', encoding='utf-8') as f:
            json.dump(quest_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Updated quest {quest_id} rating to {average_rating} (based on {len(ratings)} ratings)")
        
        return jsonify({
            'message': 'Rating submitted successfully',
            'new_average_rating': average_rating,
            'total_ratings': len(ratings)
        })
        
    except Exception as e:
        print(f"Error rating quest {quest_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/submitted-quests', methods=['GET', 'OPTIONS'])
def get_submitted_quests():
    """Get a list of all submitted quests (legacy endpoint)"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    try:
        if not ensure_quests_dir():
            return jsonify({'error': 'Failed to create quests directory'}), 500
        
        quests = []
        if os.path.exists(QUESTS_DIR):
            for quest_folder in os.listdir(QUESTS_DIR):
                quest_path = os.path.join(QUESTS_DIR, quest_folder)
                
                # Check if it's a directory
                if os.path.isdir(quest_path):
                    # Look for .js files in the quest folder
                    js_files = [f for f in os.listdir(quest_path) if f.endswith('.js')]
                    
                    for js_file in js_files:
                        try:
                            filepath = os.path.join(quest_path, js_file)
                            with open(filepath, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Extract quest info from the file content
                            name_match = re.search(r"name: '([^']+)'", content)
                            description_match = re.search(r"description: '([^']+)'", content)
                            
                            if name_match:
                                quests.append({
                                    'filename': js_file,
                                    'name': name_match.group(1),
                                    'description': description_match.group(1) if description_match else '',
                                    'waypoints': len(re.findall(r"name: '", content)) - 1  # Subtract 1 for quest name
                                })
                        except Exception as e:
                            print(f"Error reading quest file {js_file} in {quest_folder}: {e}")
                            continue
        
        return jsonify(quests)
        
    except Exception as e:
        print(f"Error getting submitted quests: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with server info"""
    return jsonify({
        'message': 'CityQuest Image Comparison Server',
        'status': 'running',
        'model_loaded': model is not None,
        'endpoints': {
            'health': '/health',
            'compare': '/compare (supports multiple answer images)',
            'leaderboard': '/leaderboard/<quest_id>',
            'quests': '/api/quests (get all available quests)',
            'quest_by_id': '/api/quests/<id> (get specific quest)',
            'quest_creator': {
                'submit_quest': '/api/submit-quest',
                'get_quests': '/api/submitted-quests'
            }
        }
    })

if __name__ == '__main__':
    # Initialize model on startup
    print("🚀 Starting CityQuest Image Comparison Server...")
    initialize_model()
    
    # Get port from environment variable or use default
    port = int(os.environ.get('PORT', 5000))
    
    print(f"✅ Server ready on port {port}")
    app.run(host='0.0.0.0', port=port)