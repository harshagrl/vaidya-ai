import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadDocument from '../components/UploadDocument';
import ConfirmationScreen from '../components/ConfirmationScreen';

/**
 * Orchestrator for the Upload → Confirmation flow.
 * 
 * State machine:
 *   'upload'       → User selects and uploads a document
 *   'confirmation' → Gemini Vision extracted data, user reviews/edits before saving
 * 
 * UploadDocument calls onParseSuccess(data) with the parsed result.
 * ConfirmationScreen calls onSaveSuccess() or onCancel() to reset.
 */
export default function UploadPage() {
  const [step, setStep] = useState('upload'); // 'upload' | 'confirmation'
  const [parsedData, setParsedData] = useState(null);
  const navigate = useNavigate();

  const handleParseSuccess = (data) => {
    setParsedData(data);
    setStep('confirmation');
  };

  const handleReset = () => {
    setParsedData(null);
    setStep('upload');
  };

  if (step === 'confirmation' && parsedData) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ConfirmationScreen
          draftData={parsedData.extractedData}
          type={parsedData.type}
          sourceImageUrl={parsedData.sourceImageUrl}
          onSaveSuccess={handleReset}
          onCancel={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <UploadDocument
        onParseSuccess={handleParseSuccess}
        onManualEntryFallback={() => navigate('/manual')}
      />
    </div>
  );
}
