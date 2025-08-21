#!/usr/bin/env python3
"""
Test script for the CLIP image comparison server
"""

import requests
import base64
import json
import sys
import os

def test_server(server_url="http://localhost:5000"):
    """Test the server with a simple request"""
    
    print(f"Testing server at: {server_url}")
    
    # Test health endpoint first
    try:
        health_response = requests.get(f"{server_url}/health", timeout=10)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"✅ Health check passed: {health_data}")
        else:
            print(f"⚠️ Health check failed: {health_response.status_code}")
    except Exception as e:
        print(f"⚠️ Health check error: {e}")
    
    # Test the new API format
    print("\nTesting new API format...")
    
    # Create a simple test payload
    test_data = {
        "playerImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        "checkpointId": 1
    }
    
    try:
        response = requests.post(
            f'{server_url}/compare',
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Server is working! Similarity: {result.get('similarity', 'N/A')}")
            return True
        else:
            print(f"❌ Server error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure it's running.")
        return False
    except requests.exceptions.Timeout:
        print("❌ Request timed out. Server might be loading the model.")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    # Get server URL from command line argument or use default
    server_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
    
    success = test_server(server_url)
    
    if success:
        print("\n🎉 Server test completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Server test failed!")
        sys.exit(1)
