import React, { useState } from 'react';
import api from '../api/axiosInstance';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadDocument({ onParseSuccess, onManualEntryFallback }) {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState(''); // Force explicit selection
  const [error, setError] = useState(null);
  const [isExtractionFailed, setIsExtractionFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    setIsExtractionFailed(false);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size exceeds the 10MB limit.');
      setFile(null);
      e.target.value = null; // reset input
      return;
    }

    // Client-side extension validation mirroring backend constraints
    if (docType === 'PRESCRIPTION' && selectedFile.type === 'application/pdf') {
      setError('Prescriptions must be images (JPG/PNG/WEBP). PDF is only supported for Lab Reports.');
      setFile(null);
      e.target.value = null;
      return;
    }

    setFile(selectedFile);
  };

  const handleDocTypeChange = (e) => {
    const newType = e.target.value;
    setDocType(newType);
    setError(null);
    setIsExtractionFailed(false);
    
    // Re-validate existing file if type changes to PRESCRIPTION and file is PDF
    if (newType === 'PRESCRIPTION' && file && file.type === 'application/pdf') {
      setError('Prescriptions must be images. Please upload an image, or switch to Lab Report.');
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!docType) {
      setError('Please select a record type.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsExtractionFailed(false);

    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', docType);

    try {
      // Uses the configured axios instance that automatically attaches the JWT
      const response = await api.post('/api/upload/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (response.data.success) {
        // Pass the raw draft JSON, type, and source image URL up to parent to show Confirmation UI
        onParseSuccess({
          extractedData: response.data.extractedData,
          sourceImageUrl: response.data.sourceImageUrl,
          type: response.data.type
        });
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errorType === 'AI_EXTRACTION_FAILED') {
        setError(err.response.data.message);
        setIsExtractionFailed(true); // Triggers the manual entry fallback UI
      } else {
        setError(err.response?.data?.message || 'Failed to upload and parse document. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8 bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Upload className="w-6 h-6 text-indigo-600" />
        Upload Health Record
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
          <div className="flex gap-4">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${docType === 'PRESCRIPTION' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <input 
                type="radio" 
                name="docType" 
                value="PRESCRIPTION" 
                checked={docType === 'PRESCRIPTION'} 
                onChange={handleDocTypeChange}
                className="sr-only"
              />
              <FileText className="w-4 h-4" />
              Prescription
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${docType === 'LAB_REPORT' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <input 
                type="radio" 
                name="docType" 
                value="LAB_REPORT" 
                checked={docType === 'LAB_REPORT'} 
                onChange={handleDocTypeChange}
                className="sr-only"
              />
              <FileText className="w-4 h-4" />
              Lab Report
            </label>
          </div>
        </div>

        {/* File Input */}
        <div className={!docType ? 'opacity-50 pointer-events-none' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Image or PDF</label>
          {!docType && <p className="text-xs text-amber-600 mb-2">Please select a Record Type above first.</p>}
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors bg-gray-50">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600 justify-center">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-1">
                  <span>Upload a file</span>
                  <input 
                    id="file-upload" 
                    name="file-upload" 
                    type="file" 
                    className="sr-only" 
                    accept={docType === 'PRESCRIPTION' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} 
                    capture="environment" // Triggers back camera on mobile
                    disabled={!docType}
                    onChange={handleFileChange} 
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {docType === 'PRESCRIPTION' ? 'PNG, JPG, WEBP up to 10MB' : 'PDF, PNG, JPG, WEBP up to 10MB'}
              </p>
              {file && (
                <p className="text-sm font-medium text-green-600 mt-3 bg-green-50 p-2 rounded">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert & Extraction Fallback */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Upload Issue</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
            
            {/* Fallback Manual Entry Options specifically for Gemini failures */}
            {isExtractionFailed && (
              <div className="mt-4 border-t border-red-200 pt-4">
                <p className="text-sm text-red-700 mb-3 font-medium">Would you like to try uploading a clearer image, or enter the details manually?</p>
                <div className="flex flex-wrap gap-3">
                  <label htmlFor="file-upload" className="cursor-pointer px-4 py-2 bg-white border border-red-300 rounded text-sm font-medium text-red-700 hover:bg-red-50 transition-colors">
                    Retake / Select New Photo
                  </label>
                  <button 
                    type="button" 
                    onClick={() => onManualEntryFallback(docType)}
                    className="px-4 py-2 bg-red-600 border border-transparent rounded text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Enter Manually Instead
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || !docType || isLoading}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing Document...
            </>
          ) : (
            'Extract Data'
          )}
        </button>
      </form>
    </div>
  );
}
