'use client';

import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RotateCw, FlipHorizontal, FlipVertical, Crop, X } from 'lucide-react';
import { getCroppedImg } from '@/lib/image';
import { toast } from 'sonner';

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspectRatio?: number; // Default 1 for square
  cropShape?: 'rect' | 'round'; // Default 'round' for profile pictures
  title?: string;
}

export function ImageCropper({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = 'round',
  title = 'Crop Image'
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flip, setFlip] = useState({ horizontal: false, vertical: false });

  const onCropCompleteCallback = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropImage = useCallback(async () => {
    if (!croppedAreaPixels) {
      toast.error('Please select a crop area');
      return;
    }

    setIsProcessing(true);
    
    try {
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        flip
      );
      
      onCropComplete(croppedImage);
      onOpenChange(false);
      
      // Reset state
      setCrop({ x: 0, y: 0 });
      setRotation(0);
      setZoom(1);
      setFlip({ horizontal: false, vertical: false });
      setCroppedAreaPixels(null);
      
      toast.success('Image cropped successfully');
    } catch (error) {
      console.error('Error cropping image:', error);
      toast.error('Failed to crop image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, rotation, flip, onCropComplete, onOpenChange]);

  const handleCancel = () => {
    onOpenChange(false);
    // Reset state
    setCrop({ x: 0, y: 0 });
    setRotation(0);
    setZoom(1);
    setFlip({ horizontal: false, vertical: false });
    setCroppedAreaPixels(null);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFlipHorizontal = () => {
    setFlip((prev) => ({ ...prev, horizontal: !prev.horizontal }));
  };

  const handleFlipVertical = () => {
    setFlip((prev) => ({ ...prev, vertical: !prev.vertical }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cropper Area */}
          <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              rotation={rotation}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onRotationChange={setRotation}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={setZoom}
              cropShape={cropShape}
              showGrid={true}
              style={{
                containerStyle: {
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'transparent',
                },
              }}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Zoom</Label>
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rotation</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[rotation]}
                  onValueChange={(value) => setRotation(value[0])}
                  min={0}
                  max={360}
                  step={1}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="shrink-0"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Flip Controls */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Flip</Label>
              <div className="flex gap-2">
                <Button
                  variant={flip.horizontal ? "default" : "outline"}
                  size="sm"
                  onClick={handleFlipHorizontal}
                  className="flex items-center gap-2"
                >
                  <FlipHorizontal className="w-4 h-4" />
                  Horizontal
                </Button>
                <Button
                  variant={flip.vertical ? "default" : "outline"}
                  size="sm"
                  onClick={handleFlipVertical}
                  className="flex items-center gap-2"
                >
                  <FlipVertical className="w-4 h-4" />
                  Vertical
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleCropImage}
            disabled={isProcessing || !croppedAreaPixels}
          >
            <Crop className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Crop Image'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}