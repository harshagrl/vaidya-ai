import React, { useState } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, Trash2, Loader2, FileText, FlaskConical, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

export default function ManualEntry() {
  const { activeProfileId } = useAuth();
  const [activeTab, setActiveTab] = useState('PRESCRIPTION');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [pendingInteractions, setPendingInteractions] = useState([]);
  const [minorInteractionsCount, setMinorInteractionsCount] = useState(0);

  const initialPrescriptionState = {
    prescribedDate: '',
    prescribingDoctor: '',
    medicines: [{ medicineName: '', dosage: '', frequency: '', duration: '', doctorNotes: '', confidenceScores: {} }]
  };

  const initialLabReportState = {
    testDate: '',
    labTests: [{ testName: '', value: '', unit: '', referenceRange: '', isAbnormalFlag: false, confidenceScores: {} }]
  };

  const [formData, setFormData] = useState(initialPrescriptionState);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;

    const isDirty = JSON.stringify(formData) !== JSON.stringify(
      activeTab === 'PRESCRIPTION' ? initialPrescriptionState : initialLabReportState
    );

    if (isDirty) {
      const confirmed = window.confirm('Switching tabs will discard your unsaved entries. Are you sure you want to continue?');
      if (!confirmed) return;
    }

    setActiveTab(tab);
    setFormData(tab === 'PRESCRIPTION' ? initialPrescriptionState : initialLabReportState);
    setError(null);
    setSuccessMsg(null);
  };

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

  const renderInput = (name, value, onChange, placeholder = '', required = false) => (
    <input
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${required && !value ? 'bg-indigo-50/30' : 'bg-white'}`}
    />
  );

  const validateForm = () => {
    if (!activeProfileId) return 'Please select a family member profile from the top header first.';
    if (activeTab === 'PRESCRIPTION' && (!formData.medicines || formData.medicines.length === 0)) return 'A prescription must have at least one medicine.';
    if (activeTab === 'LAB_REPORT' && (!formData.labTests || formData.labTests.length === 0)) return 'A lab report must have at least one test.';
    if (activeTab === 'PRESCRIPTION' && (!formData.prescribedDate || !formData.prescribingDoctor)) return 'Please fill in both Date and Doctor Name.';
    if (activeTab === 'LAB_REPORT' && !formData.testDate) return 'Please fill in the Test Date.';
    
    if (activeTab === 'PRESCRIPTION') {
      if (formData.medicines.some(m => !m.medicineName || m.medicineName.trim() === '')) return 'Please provide a Medicine Name for all added rows.';
    }
    
    if (activeTab === 'LAB_REPORT') {
      if (formData.labTests.some(t => !t.testName || t.testName.trim() === '' || !t.value || t.value.trim() === '')) return 'Please provide a Test Name and Value for all added rows.';
    }
    return null;
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        type: activeTab,
        ...formData
      };
      
      const response = await api.post(`/api/profiles/${activeProfileId}/records`, payload);
      if (response.data.success) {
        setSuccessMsg('Record saved successfully!');
        setFormData(activeTab === 'PRESCRIPTION' ? initialPrescriptionState : initialLabReportState);
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.interactions) {
        const severe = err.response.data.interactions.filter(i => i.severity === 'Severe/Contraindicated');
        const minorCount = err.response.data.interactions.length - severe.length;
        setPendingInteractions(severe);
        setMinorInteractionsCount(minorCount);
        setShowInteractionModal(true);
      } else {
        setError(err.response?.data?.message || 'Failed to save record. Please ensure all required fields are filled.');
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
    setSuccessMsg(null);

    const acknowledgedInteractions = pendingInteractions.map(i => ({
      medicineA: i.medicineA,
      medicineB: i.medicineB,
      severity: i.severity
    }));

    try {
      const payload = {
        type: activeTab,
        ...formData,
        acknowledgedInteractions
      };
      
      const response = await api.post(`/api/profiles/${activeProfileId}/records`, payload);
      if (response.data.success) {
        setSuccessMsg('Record saved successfully!');
        setFormData(activeTab === 'PRESCRIPTION' ? initialPrescriptionState : initialLabReportState);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className="max-w-4xl mx-auto mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-6 pb-0">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Manual Entry</h2>
        <p className="text-gray-600 text-sm mb-6">Create a health record manually without uploading an image.</p>
        
        {/* Tabs */}
        <div className="flex gap-4">
          <button 
            onClick={() => handleTabChange('PRESCRIPTION')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${activeTab === 'PRESCRIPTION' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="w-4 h-4" /> Prescription
          </button>
          <button 
            onClick={() => handleTabChange('LAB_REPORT')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${activeTab === 'LAB_REPORT' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <FlaskConical className="w-4 h-4" /> Lab Report
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6">
        
        {!activeProfileId && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              No profile selected. Please select a family member from the top navigation bar before saving.
            </p>
          </div>
        )}

        {/* PRESCRIPTION FORM */}
        {activeTab === 'PRESCRIPTION' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescribed Date *</label>
                {renderInput('prescribedDate', formData.prescribedDate, handleInputChange, 'YYYY-MM-DD', true)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                {renderInput('prescribingDoctor', formData.prescribingDoctor, handleInputChange, 'Dr. Smith', true)}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <label className="block text-sm font-medium text-gray-700">Medicines</label>
                <button 
                  type="button" 
                  onClick={() => addRow('medicines', { medicineName: '', dosage: '', frequency: '', duration: '', doctorNotes: '', confidenceScores: {} })} 
                  className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Medicine
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.medicines.map((med, idx) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 relative group">
                    <button 
                      type="button" 
                      onClick={() => removeRow('medicines', idx)} 
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="md:col-span-2 lg:col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Medicine Name *</label>
                        {renderInput('medicineName', med.medicineName, (e) => handleArrayChange('medicines', idx, 'medicineName', e.target.value), '', true)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Dosage</label>
                        {renderInput('dosage', med.dosage, (e) => handleArrayChange('medicines', idx, 'dosage', e.target.value), 'e.g. 500mg')}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                        {renderInput('frequency', med.frequency, (e) => handleArrayChange('medicines', idx, 'frequency', e.target.value), 'e.g. 1-0-1')}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Duration</label>
                        {renderInput('duration', med.duration, (e) => handleArrayChange('medicines', idx, 'duration', e.target.value), 'e.g. 5 days')}
                      </div>
                      <div className="md:col-span-2 lg:col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Instructions / Notes</label>
                        {renderInput('doctorNotes', med.doctorNotes, (e) => handleArrayChange('medicines', idx, 'doctorNotes', e.target.value), 'e.g. Take after meals')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LAB REPORT FORM */}
        {activeTab === 'LAB_REPORT' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Date *</label>
                {renderInput('testDate', formData.testDate, handleInputChange, 'YYYY-MM-DD', true)}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <label className="block text-sm font-medium text-gray-700">Lab Tests</label>
                <button 
                  type="button" 
                  onClick={() => addRow('labTests', { testName: '', value: '', unit: '', referenceRange: '', isAbnormalFlag: false, confidenceScores: {} })} 
                  className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Test
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.labTests.map((test, idx) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 relative group">
                    <button 
                      type="button" 
                      onClick={() => removeRow('labTests', idx)} 
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Test Name *</label>
                        {renderInput('testName', test.testName, (e) => handleArrayChange('labTests', idx, 'testName', e.target.value), '', true)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Value *</label>
                        {renderInput('value', test.value, (e) => handleArrayChange('labTests', idx, 'value', e.target.value), '', true)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit</label>
                        {renderInput('unit', test.unit, (e) => handleArrayChange('labTests', idx, 'unit', e.target.value), 'e.g. mg/dL')}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Reference Range</label>
                        {renderInput('referenceRange', test.referenceRange, (e) => handleArrayChange('labTests', idx, 'referenceRange', e.target.value), 'e.g. 70-100')}
                      </div>
                      <div className="md:col-span-2 flex items-center mt-1">
                        <input 
                          type="checkbox" 
                          checked={test.isAbnormalFlag || false} 
                          onChange={(e) => handleArrayChange('labTests', idx, 'isAbnormalFlag', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label className="ml-2 text-sm text-gray-700 cursor-pointer" onClick={() => handleArrayChange('labTests', idx, 'isAbnormalFlag', !test.isAbnormalFlag)}>
                          Flagged as Abnormal
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messaging & Actions */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mt-6 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
          <button 
            type="submit" 
            disabled={isSaving || !activeProfileId}
            className="px-6 py-2.5 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Record
          </button>
        </div>
      </form>
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
                type="button"
                onClick={() => setShowInteractionModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel & Edit
              </button>
              <button
                type="button"
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
