import * as faceapi from 'face-api.js';
import { RegisteredUser } from '../types';

// Configuration
const MODEL_URL = '/models';
const SSD_MOBILENETV1 = 'ssd_mobilenetv1';
// const TINY_FACE_DETECTOR = 'tiny_face_detector';

let modelsLoaded = false;

export const loadModels = async () => {
    if (modelsLoaded) return;
    try {
        console.log("Loading FaceAPI models...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log("FaceAPI models loaded successfully.");
    } catch (error) {
        console.error("Failed to load FaceAPI models:", error);
        throw error;
    }
};

const getImageElement = (base64: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
};

/**
 * Detects if a face is present in the image.
 */
export const detectFaceInImage = async (base64Image: string): Promise<{ hasFace: boolean; message: string }> => {
    if (!modelsLoaded) {
        return { hasFace: false, message: "Models not loaded yet" };
    }

    try {
        const img = await getImageElement(base64Image);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (detection) {
            return { hasFace: true, message: "Face detected" };
        } else {
            return { hasFace: false, message: "No face detected" };
        }
    } catch (error: any) {
        console.error("Face Detection Error:", error);
        return { hasFace: false, message: `Error: ${error.message || "Detection failed"}` };
    }
};

/**
 * Compares the captured face against registered users to find a match.
 */
// Cache for labeled descriptors
let faceMatcher: faceapi.FaceMatcher | null = null;

export const initializeFaceMatcher = async (users: RegisteredUser[]) => {
    if (!modelsLoaded) return;

    console.log("Initializing Face Matcher with", users.length, "users...");
    const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];

    for (const user of users) {
        try {
            const userImg = await getImageElement(user.faceImage);
            const userDetection = await faceapi.detectSingleFace(userImg).withFaceLandmarks().withFaceDescriptor();
            if (userDetection) {
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(user.id, [userDetection.descriptor]));
            }
        } catch (e) {
            console.warn(`Could not process user ${user.username} for matching`, e);
        }
    }

    if (labeledDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        console.log("Face Matcher initialized.");
    } else {
        faceMatcher = null;
    }
};

/**
 * Compares the captured face against registered users to find a match.
 */
export const identifyUser = async (
    capturedBase64: string,
    candidates: RegisteredUser[] // Kept for signature compatibility, but we use cached matcher
): Promise<{ matchFound: boolean; userId?: string }> => {
    if (!modelsLoaded) return { matchFound: false };

    // If matcher is not initialized but we have candidates, try to init (lazy init)
    if (!faceMatcher && candidates.length > 0) {
        await initializeFaceMatcher(candidates);
    }

    if (!faceMatcher) return { matchFound: false };

    try {
        const img = await getImageElement(capturedBase64);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            return { matchFound: false };
        }

        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label !== 'unknown') {
            return { matchFound: true, userId: match.label };
        } else {
            return { matchFound: false };
        }

    } catch (error) {
        console.error("Identification Error:", error);
        return { matchFound: false };
    }
};
