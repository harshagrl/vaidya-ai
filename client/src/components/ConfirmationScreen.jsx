import React, { useState } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { Save, X, AlertCircle, Image as ImageIcon, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const UNREADABLE = 'UNREADABLE';

export default function ConfirmationScreen({ draftData, type, sourceImageUrl, onSaveSuccess, onCancel }) {
  const { activeProfileId } = useAuth();
  // Clone draft data deeply to avoid mutating props
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(draftData)));
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [pendingInteractions, setPendingInteractions] = useState([]);
  const [minorInteractionsCount, setMinorInteractionsCount] = useState(0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleArrayChange = (arrayName, index, field, value) => {
    setFormData(prev => {
      const newArray = [...prev[arrayName]];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayName]: newArray };
    });
  };

  const addRow = (arrayName, template) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: [...(prev[arrayName] || []), template]
    }));
  };

  const removeRow = (arrayName, index) => {
    setFormData(prev => {
      const newArray = [...prev[arrayName]];
      newArray.splice(index, 1);
      return { ...prev, [arrayName]: newArray };
    });
  };

  const isUnreadable = (value) => value === UNREADABLE;

  // Recursive check for UNREADABLE values instead of blind stringify search
  const hasUnreadableValues = (obj) => {
    if (!obj) return false;
    if (typeof obj === 'string') return obj === UNREADABLE;
    if (Array.isArray(obj)) return obj.some(hasUnreadableValues);
    if (typeof obj === 'object') return Object.values(obj).some(hasUnreadableValues);
    return false;
  };

  const renderInput = (value, onChange, placeholder = '') => {
    const needsReview = isUnreadable(value);
    return (
      <input
        type="text"
        value={needsReview ? '' : (value || '')}
        onChange={onChange}
        placeholder={needsReview ? 'Please enter manually' : placeholder}
        className={`w-full p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${needsReview ? 'border-red-400 bg-red-50 placeholder-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 bg-white'
          }`}
      />
    );
  };

  const validateForm = () => {
    if (!activeProfileId) return 'Please select a family member profile. (Note: Profile switcher UI pending)';
    if (type === 'PRESCRIPTION' && (!formData.medicines || formData.medicines.length === 0)) return 'A prescription must have at least one medicine. Please add one before saving.';
    if (type === 'LAB_REPORT' && (!formData.labTests || formData.labTests.length === 0)) return 'A lab report must have at least one lab test. Please add one before saving.';
    if (hasUnreadableValues(formData)) return 'Please fill in all unreadable or missing fields (highlighted in red) before saving.';
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        type,
        sourceImageUrl,
        ...formData
      };
      const response = await api.post(`/api/profiles/${activeProfileId}/records`, payload);
      if (response.data.success) {
        onSaveSuccess(response.data.data);
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.interactions) {
        const severe = err.response.data.interactions.filter(i => i.severity === 'Severe/Contraindicated');
        const minorCount = err.response.data.interactions.length - severe.length;
        setPendingInteractions(severe);
        setMinorInteractionsCount(minorCount);
        setShowInteractionModal(true);
      } else {
        setError(err.response?.data?.message || 'Failed to save record.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcknowledgeAndSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setShowInteractionModal(false);
      return;
    }

    setShowInteractionModal(false);
    setIsSaving(true);
    setError(null);

    const acknowledgedInteractions = pendingInteractions.map(i => ({
      medicineA: i.medicineA,
      medicineB: i.medicineB,
      severity: i.severity
    }));

    try {
      const payload = {
        type,
        sourceImageUrl,
        ...formData,
        acknowledgedInteractions
      };
      const response = await api.post(`/api/profiles/${activeProfileId}/records`, payload);
      if (response.data.success) {
        onSaveSuccess(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="max-w-6xl mx-auto mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col md:flex-row">

        {/* Left Column: Image Viewer */}
        <div className="w-full md:w-1/2 bg-gray-50 border-r border-gray-200 p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-500" />
            Source Document
          </h3>
          <div className="flex-1 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
            {sourceImageUrl ? (
              <img src={sourceImageUrl} alt="Uploaded Document" className="max-w-full max-h-[800px] object-contain" />
            ) : (
              <span className="text-gray-400">No image available</span>
            )}
          </div>
        </div>

        {/* Right Column: Form Editor */}
        <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Review & Confirm</h2>
            <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {hasUnreadableValues(formData) && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                The AI couldn't read some fields clearly (highlighted in red). Please verify against the image and correct them.
              </p>
            </div>
          )}

          <div className="space-y-6 flex-1">
            {type === 'PRESCRIPTION' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    {renderInput(formData.prescribedDate, (e) => handleInputChange({ target: { name: 'prescribedDate', value: e.target.value } }))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
                    {renderInput(formData.prescribingDoctor, (e) => handleInputChange({ target: { name: 'prescribingDoctor', value: e.target.value } }))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Medicines</label>
                    <button
                      type="button"
                      onClick={() => addRow('medicines', {
                        medicineName: '',
                        dosage: '',
                        frequency: '',
                        duration: '',
                        doctorNotes: '',
                        confidenceScores: {}
                      })}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="w-3 h-3" /> Add Medicine
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(formData.medicines || []).map((med, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg bg-gray-50 relative group">
                        <button type="button" onClick={() => removeRow('medicines', idx)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Medicine Name *</label>
                            {renderInput(med.medicineName, (e) => handleArrayChange('medicines', idx, 'medicineName', e.target.value))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Dosage</label>
                            {renderInput(med.dosage, (e) => handleArrayChange('medicines', idx, 'dosage', e.target.value))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                            {renderInput(med.frequency, (e) => handleArrayChange('medicines', idx, 'frequency', e.target.value))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Duration</label>
                            {renderInput(med.duration, (e) => handleArrayChange('medicines', idx, 'duration', e.target.value))}
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Instructions / Notes</label>
                            {renderInput(med.doctorNotes, (e) => handleArrayChange('medicines', idx, 'doctorNotes', e.target.value))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!formData.medicines || formData.medicines.length === 0) && (
                      <p className="text-sm text-red-500 italic">At least one medicine is required.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {type === 'LAB_REPORT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                  {renderInput(formData.testDate, (e) => handleInputChange({ target: { name: 'testDate', value: e.target.value } }))}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Lab Tests</label>
                    <button
                      type="button"
                      onClick={() => addRow('labTests', {
                        testName: '',
                        value: '',
                        unit: '',
                        referenceRange: '',
                        isAbnormalFlag: false,
                        confidenceScores: {}
                      })}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="w-3 h-3" /> Add Test
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(formData.labTests || []).map((test, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg bg-gray-50 relative group">
                        <button type="button" onClick={() => removeRow('labTests', idx)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Test Name *</label>
                            {renderInput(test.testName, (e) => handleArrayChange('labTests', idx, 'testName', e.target.value))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Value *</label>
                            {renderInput(test.value, (e) => handleArrayChange('labTests', idx, 'value', e.target.value))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unit</label>
                            {renderInput(test.unit, (e) => handleArrayChange('labTests', idx, 'unit', e.target.value))}
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Reference Range</label>
                            {renderInput(test.referenceRange, (e) => handleArrayChange('labTests', idx, 'referenceRange', e.target.value))}
                          </div>
                          <div className="col-span-2 flex items-center mt-2">
                            <input
                              type="checkbox"
                              checked={test.isAbnormalFlag || false}
                              onChange={(e) => handleArrayChange('labTests', idx, 'isAbnormalFlag', e.target.checked)}
                              className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label className="text-sm text-gray-700">Flagged as Abnormal</label>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!formData.labTests || formData.labTests.length === 0) && (
                      <p className="text-sm text-red-500 italic">At least one lab test is required.</p>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>

          {error && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2 flex-shrink-0">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 transition-colors flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirm & Save Record
            </button>
          </div>
        </div>
      </div>


      {/* Interaction Warning Modal */}
      {showInteractionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-red-100">
            <div className="bg-red-50 border-b border-red-100 p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <h3 className="text-lg font-bold text-red-900">Severe Interactions Detected</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                The following severe drug interactions or contraindications were found between the medicines you are trying to save and the active medicines on this profile.
              </p>
              <ul className="space-y-3 mb-4">
                {pendingInteractions.map((i, idx) => (
                  <li key={idx} className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-800">
                    <strong>{i.medicineA}</strong> + <strong>{i.medicineB}</strong>: {i.description}
                  </li>
                ))}
              </ul>
              {minorInteractionsCount > 0 && (
                <p className="text-sm text-amber-600 font-medium mb-6">
                  Note: {minorInteractionsCount} Minor/Moderate interaction(s) were also detected. These will be saved to your timeline for review.
                </p>
              )}
              <p className="text-sm text-gray-700 font-medium mb-6">
                Are you sure you want to proceed and save this prescription?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowInteractionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel & Edit
                </button>
                <button
                  onClick={handleAcknowledgeAndSave}
                  className="px-4 py-2 bg-red-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Acknowledge & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
