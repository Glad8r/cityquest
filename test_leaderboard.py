#!/usr/bin/env python3
"""
Simple test script to verify leaderboard functionality for Aloha quest
"""

import requests
import json

# Server URL (change this to match your server)
SERVER_URL = "https://6f589f8805fd.ngrok-free.app"

def test_aloha_leaderboard():
    """Test the leaderboard for Aloha quest (ID: 2)"""
    
    quest_id = 2  # Aloha quest ID
    
    print("🧪 Testing Aloha Quest Leaderboard...")
    print(f"Server URL: {SERVER_URL}")
    print(f"Quest ID: {quest_id}")
    print("-" * 50)
    
    # Test 1: Get leaderboard for Aloha quest
    print("1. Testing GET leaderboard for Aloha quest...")
    try:
        response = requests.get(f"{SERVER_URL}/leaderboard/{quest_id}")
        if response.status_code == 200:
            data = response.json()
            leaderboard = data.get('leaderboard', [])
            print(f"✅ Success: {len(leaderboard)} entries found")
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if leaderboard:
                print("\n   Leaderboard entries:")
                for i, entry in enumerate(leaderboard, 1):
                    print(f"   {i}. {entry['team_name']} - {entry['waypoints_completed']} waypoints - {entry['completion_time']}ms")
            else:
                print("   No entries found in leaderboard")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    
    # Test 2: Add a test entry to Aloha leaderboard
    print("2. Testing POST new leaderboard entry for Aloha quest...")
    test_entry = {
        "team_name": "Test Team Aloha",
        "waypoints_completed": 5,
        "completion_time": 1800000,  # 30 minutes in milliseconds
        "quest_date": "2024-01-15"
    }
    
    try:
        response = requests.post(
            f"{SERVER_URL}/leaderboard/{quest_id}",
            headers={"Content-Type": "application/json"},
            json=test_entry
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('message', 'Entry added')}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    
    # Test 3: Get leaderboard again to verify the new entry
    print("3. Testing GET leaderboard again (should have new entry)...")
    try:
        response = requests.get(f"{SERVER_URL}/leaderboard/{quest_id}")
        if response.status_code == 200:
            data = response.json()
            leaderboard = data.get('leaderboard', [])
            print(f"✅ Success: {len(leaderboard)} entries found")
            print("   Updated leaderboard entries:")
            for i, entry in enumerate(leaderboard, 1):
                print(f"   {i}. {entry['team_name']} - {entry['waypoints_completed']} waypoints - {entry['completion_time']}ms")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    print("🎉 Aloha leaderboard testing completed!")

if __name__ == "__main__":
    test_aloha_leaderboard()
