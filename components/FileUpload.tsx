
import React, { useCallback, useState, useRef } from 'react';
import { UploadIcon } from './icons';
import { FileType } from '../types';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  fileType: FileType | null;
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, fileType, multiple = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => onFileUpload(file));
      e.target.value = '';
    }
  };

  const handleContainerClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => onFileUpload(file));
    }
  }, [onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Update: Allow video uploads even for IMAGE mode (we will extract frame)
  let acceptType = 'image/*,video/*';
  let descriptionText = multiple ? 'Upload Multiple Assets' : 'Image or Video';

  if (fileType === FileType.IMAGE || fileType === FileType.IMAGE_TO_VIDEO || fileType === FileType.TARGETED_IMAGE) {
    // We allow video here now, to extract frames
    acceptType = 'image/*,video/*';
    descriptionText = 'Images (JPG, PNG) or Video Source';
  } else if (fileType === FileType.VIDEO) {
    acceptType = 'video/*,image/*';
    descriptionText = 'Videos (MP4, WEBM) or Images';
  }

  return (
    <div className="w-full">
        <div
            onClick={handleContainerClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${
                isDragging 
                ? 'border-brand-primary bg-indigo-50 scale-102 shadow-lg' 
                : 'border-slate-300 bg-white hover:bg-slate-50'
            }`}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                <UploadIcon className={`w-8 h-8 mb-3 transition-colors duration-300 ${isDragging ? 'text-brand-primary' : 'text-slate-400'}`} />
                <p className="mb-2 text-sm text-slate-500">
                    <span className="font-semibold text-brand-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">{descriptionText}</p>
            </div>
            <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept={acceptType} 
                onChange={handleFileChange} 
                multiple={multiple}
            />
        </div>
    </div>
  );
};
