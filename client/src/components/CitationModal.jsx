import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { X, Loader2, FileText, FlaskConical } from 'lucide-react';
import dayjs from 'dayjs';

export default function CitationModal({ recordId, onClose }) {
  const { activeProfileId } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const response = await api.get(`/api/profiles/${activeProfileId}/records/${recordId}`);
        setRecord(response.data.data);
      } catch (err) {
        setError('Failed to load citation source.');
      } finally {
        setLoading(false);
      }
    };
    if (activeProfileId && recordId) {
      fetchRecord();
    }
  }, [activeProfileId, recordId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500"><X className="w-5 h-5"/></button>
          <p className="text-red-500">{error || 'Record not found.'}</p>
        </div>
      </div>
    );
  }

  // Determine standard title and icon
  const isPrescription = record.type === 'PRESCRIPTION';
  const Icon = isPrescription ? FileText : FlaskConical;
  const title = isPrescription ? 'Prescription Source' : 'Lab Report Source';
  const displayDate = isPrescription 
    ? (record.prescribedDate ? dayjs(record.prescribedDate).format('MMM D, YYYY') : 'Unknown Date')
    : (record.testDate ? dayjs(record.testDate).format('MMM D, YYYY') : 'Unknown Date');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-800">{title}</h2>
            <span className="text-sm text-gray-500 ml-2 border-l border-gray-300 pl-2">{displayDate}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[300px]">
          {/* Left side Image if exists */}
          {record.sourceImageUrl && (
            <div className="w-full md:w-1/2 bg-gray-100 border-r border-gray-200 p-4 overflow-y-auto flex items-center justify-center">
              <img src={record.sourceImageUrl} alt="Source Document" className="max-w-full max-h-full object-contain shadow-sm rounded border border-gray-300" />
            </div>
          )}
          
          {/* Right side Extracted Data */}
          <div className={`w-full ${record.sourceImageUrl ? 'md:w-1/2' : ''} p-6 overflow-y-auto`}>
            <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2">Extracted Information</h3>
            
            {isPrescription && record.medicines && (
              <ul className="space-y-4">
                {record.medicines.map((med, idx) => (
                  <li key={idx} className="bg-indigo-50/50 p-3 rounded border border-indigo-100">
                    <p className="font-medium text-gray-900">{med.medicineName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {med.dosage && med.dosage !== 'UNREADABLE' ? med.dosage : ''} 
                      {med.frequency && med.frequency !== 'UNREADABLE' ? ` • ${med.frequency}` : ''}
                      {med.duration && med.duration !== 'UNREADABLE' ? ` • ${med.duration}` : ''}
                    </p>
                    {med.doctorNotes && med.doctorNotes !== 'UNREADABLE' && (
                      <p className="text-xs text-gray-500 italic mt-1">"{med.doctorNotes}"</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isPrescription && record.labTests && (
              <ul className="space-y-3">
                {record.labTests.map((test, idx) => (
                  <li key={idx} className={`p-3 rounded border ${test.isAbnormalFlag ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex justify-between items-start">
                      <p className={`font-medium ${test.isAbnormalFlag ? 'text-red-900' : 'text-gray-800'}`}>{test.testName}</p>
                      <p className={`font-bold ${test.isAbnormalFlag ? 'text-red-700' : 'text-gray-900'}`}>
                        {test.value} <span className="text-xs font-normal text-gray-500">{test.unit && test.unit !== 'UNREADABLE' ? test.unit : ''}</span>
                      </p>
                    </div>
                    {test.referenceRange && test.referenceRange !== 'UNREADABLE' && (
                      <p className="text-xs text-gray-500 mt-1">Ref: {test.referenceRange}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
