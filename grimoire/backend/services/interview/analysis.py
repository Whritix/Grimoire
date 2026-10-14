import cv2
import mediapipe as mp
import numpy as np
import os
import requests
from typing import Dict, Any
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from shared.utils import get_logger

logger = get_logger(__name__)

class VideoAnalyzer:
    def __init__(self):
        self.enabled = False
        self.face_landmarker = None
        self.pose_landmarker = None
        
        try:
            self._setup_models()
            self._initialize_detectors()
            self.enabled = True
        except Exception as e:
            logger.error(f"Failed to initialize VideoAnalyzer (Tasks API): {e}")
            self.enabled = False

    def _setup_models(self):
        """Ensure model task files exist."""
        models_dir = os.path.join(os.path.dirname(__file__), "../../data/models")
        os.makedirs(models_dir, exist_ok=True)
        
        self.face_model_path = os.path.join(models_dir, "face_landmarker.task")
        self.pose_model_path = os.path.join(models_dir, "pose_landmarker_lite.task")
        
        # Download Face Model
        if not os.path.exists(self.face_model_path):
            logger.info("Downloading Face Landmarker model...")
            url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            r = requests.get(url, allow_redirects=True)
            with open(self.face_model_path, 'wb') as f:
                f.write(r.content)
                
        # Download Pose Model
        if not os.path.exists(self.pose_model_path):
            logger.info("Downloading Pose Landmarker model...")
            url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
            r = requests.get(url, allow_redirects=True)
            with open(self.pose_model_path, 'wb') as f:
                f.write(r.content)

    def _initialize_detectors(self):
        # Face Landmarker
        base_options_face = python.BaseOptions(model_asset_path=self.face_model_path)
        options_face = vision.FaceLandmarkerOptions(
            base_options=base_options_face,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(options_face)
        
        # Pose Landmarker
        base_options_pose = python.BaseOptions(model_asset_path=self.pose_model_path)
        options_pose = vision.PoseLandmarkerOptions(
            base_options=base_options_pose,
            num_poses=1
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(options_pose)

    def process_frame(self, image_data: bytes) -> Dict[str, Any]:
        if not self.enabled:
            return {"warning": "Analysis disabled"}

        try:
            # Decode and convert
            nparr = np.frombuffer(image_data, np.uint8)
            image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image_bgr is None:
                return {"error": "Failed to decode"}
            
            image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            
            results = {
                "face_detected": False,
                "eye_contact": False,
                "smile_detected": False,
                "posture_score": 0.0,
                "sentiment": "neutral"
            }
            
            # 1. Face Analysis
            face_result = self.face_landmarker.detect(mp_image)
            if face_result.face_landmarks:
                results["face_detected"] = True
                landmarks = face_result.face_landmarks[0]
                
                # Eye Contact (Head Yaw + Eye Gaze)
                # Helper: approximate yaw by nose position relative to cheekbones
                # Landmarks: 1 (nose tip), 454 (left cheek), 234 (right cheek)
                nose = landmarks[1]
                left_cheek = landmarks[454]  # perceived left (actual right of face)
                right_cheek = landmarks[234] # perceived right
                
                face_w = abs(right_cheek.x - left_cheek.x)
                if face_w > 0:
                    # 0.0 = left cheek, 1.0 = right cheek. Center ~ 0.5
                    rel_nose_x = (nose.x - left_cheek.x) / (right_cheek.x - left_cheek.x) if (right_cheek.x - left_cheek.x) != 0 else 0.5
                    
                    # Loosen tolerance: 0.35 to 0.65 is roughly "looking forward"
                    if 0.35 < rel_nose_x < 0.65:
                        results["eye_contact"] = True

                # Smile Detection via Blendshapes (Best method)
                # If blendshapes are missing, fallback to landmarks is complex, but Tasks API usually returns them if initialized
                if face_result.face_blendshapes:
                    blendshapes = face_result.face_blendshapes[0]
                    
                    # Map categories to a dict for easy access
                    scores = {b.category_name: b.score for b in blendshapes}
                    
                    smile_left = scores.get('mouthSmileLeft', 0.0)
                    smile_right = scores.get('mouthSmileRight', 0.0)
                    
                    # Combined score. Threshold 0.4 is usually distinct smile.
                    if (smile_left + smile_right) / 2 > 0.4:
                        results["smile_detected"] = True
                        results["sentiment"] = "positive"
                    
            # 2. Pose Analysis
            pose_result = self.pose_landmarker.detect(mp_image)
            if pose_result.pose_landmarks:
                landmarks = pose_result.pose_landmarks[0]
                left_shoulder = landmarks[11]
                right_shoulder = landmarks[12]
                
                # Check shoulder levelness
                slope = abs(left_shoulder.y - right_shoulder.y)
                
                # 0.05 is quite strict. Relax to 0.08
                if slope < 0.08:
                    results["posture_score"] = 1.0
                elif slope < 0.15:
                    results["posture_score"] = 0.7
                else:
                    results["posture_score"] = 0.4
                    
            logger.info(f"Video Analysis Result: {results}") # Debug log
            return results

        except Exception as e:
            logger.error(f"Frame processing error: {e}")
            return {"error": str(e)}

    def __del__(self):
        # Tasks API doesn't strictly require close, but good practice if methods exist
        pass
