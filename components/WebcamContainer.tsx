import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Camera, CameraOff, Video } from 'lucide-react';

export interface WebcamHandle {
  capture: () => string | null;
}

interface WebcamContainerProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  overlayText?: string;
}

const WebcamContainer = forwardRef<WebcamHandle, WebcamContainerProps>(({ isActive, onToggle, overlayText }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    capture: () => {
      if (!videoRef.current || !isActive) return null;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.9);
      }
      return null;
    }
  }));

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setPermissionError(null);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setPermissionError("Camera access denied or unavailable.");
        onToggle(false);
      }
    };

    if (isActive) {
      startCamera();
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, onToggle]);

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 aspect-video flex flex-col items-center justify-center">
      {isActive ? (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
          />
          <div className="absolute top-4 right-4 animate-pulse">
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div>
          </div>
          {overlayText && (
             <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                  {overlayText}
                </span>
             </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center text-slate-500">
          <Video className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">{permissionError || "Camera is turned off"}</p>
        </div>
      )}

      <button
        onClick={() => onToggle(!isActive)}
        className={`absolute bottom-6 right-6 p-4 rounded-full shadow-lg transition-all transform hover:scale-105 ${
          isActive 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
        }`}
      >
        {isActive ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
      </button>
    </div>
  );
});

WebcamContainer.displayName = 'WebcamContainer';
export default WebcamContainer;
