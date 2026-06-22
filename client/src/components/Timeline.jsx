import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { Loader2, FileText, FlaskConical, AlertTriangle, HelpCircle, Activity, Calendar } from 'lucide-react';
import dayjs from 'dayjs';

export default function Timeline() {
  const { activeProfileId } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRecords = async () => {
    if (!activeProfileId) return;

    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get(`/api/profiles/${activeProfileId}/records`, { params });
      if (response.data.success) {
        setRecords(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
      setError('Failed to load health records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, filterType, startDate, endDate]);

  const renderInteractions = (record) => {
    if (!record.interactions || record.interactions.length === 0) return null;

    const severe = record.interactions.filter(i => i.severity === 'Severe/Contraindicated');
    const minorModerate = record.interactions.filter(i => i.severity !== 'Severe/Contraindicated');

    return (
      <div className="space-y-3 mt-4">
        {severe.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-semibold text-red-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4" /> Acknowledged Severe Interactions
            </h4>
            <ul className="space-y-1">
              {severe.map((interaction, idx) => (
                <li key={idx} className="text-xs text-red-700">
                  <strong>{interaction.medicineA}</strong> + <strong>{interaction.medicineB}</strong>: {interaction.description || 'Severe interaction detected.'}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {minorModerate.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4" /> Caution: Minor/Moderate Interactions
            </h4>
            <ul className="space-y-1">
              {minorModerate.map((interaction, idx) => (
                <li key={idx} className="text-xs text-yellow-700">
                  <strong>{interaction.medicineA}</strong> + <strong>{interaction.medicineB}</strong>: {interaction.description || 'Interaction detected.'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderUncheckedMedicines = (record) => {
    if (!record.uncheckedMedicines || record.uncheckedMedicines.length === 0) return null;

    return (
      <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-md flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-600 font-medium">Could not check for interactions</p>
          <p className="text-xs text-gray-500">The following were not found in our database: {record.uncheckedMedicines.join(', ')}</p>
        </div>
      </div>
    );
  };

  const renderPrescriptionCard = (record) => {
    const displayDate = record.prescribedDate ? dayjs(record.prescribedDate).format('MMM D, YYYY') : dayjs(record.createdAt).format('MMM D, YYYY');
    
    return (
      <div key={record._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="border-b border-gray-100 bg-indigo-50/50 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Prescription</h3>
              <p className="text-xs text-gray-500">{record.prescribingDoctor || 'Unknown Doctor'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3 text-gray-400" /> {displayDate}</p>
          </div>
        </div>

        <div className="p-4">
          <ul className="space-y-4">
            {record.medicines.map((med, idx) => {
              const isAssumedActive = !med.duration || med.duration === 'UNREADABLE';
              
              return (
                <li key={idx} className="flex justify-between items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-gray-800">{med.medicineName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {med.dosage && med.dosage !== 'UNREADABLE' ? med.dosage : ''} 
                      {med.frequency && med.frequency !== 'UNREADABLE' ? ` • ${med.frequency}` : ''}
                    </p>
                    {med.doctorNotes && med.doctorNotes !== 'UNREADABLE' && (
                      <p className="text-xs text-gray-500 italic mt-1">"{med.doctorNotes}"</p>
                    )}
                  </div>
                  <div className="text-right">
                    {!isAssumedActive ? (
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded-full">{med.duration}</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1 inline-flex">
                        <AlertTriangle className="w-3 h-3" /> Assumed active (30d)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {renderUncheckedMedicines(record)}
          {renderInteractions(record)}

          {record.sourceImageUrl && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a href={record.sourceImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
                View Source Document
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLabReportCard = (record) => {
    const displayDate = record.testDate ? dayjs(record.testDate).format('MMM D, YYYY') : dayjs(record.createdAt).format('MMM D, YYYY');

    return (
      <div key={record._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="border-b border-gray-100 bg-emerald-50/50 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Lab Report</h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3 text-gray-400" /> {displayDate}</p>
          </div>
        </div>

        <div className="p-4">
          <ul className="space-y-3">
            {record.labTests.map((test, idx) => (
              <li key={idx} className={`p-3 rounded-lg flex justify-between items-center ${test.isAbnormalFlag ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-transparent'}`}>
                <div>
                  <p className={`font-medium ${test.isAbnormalFlag ? 'text-red-900' : 'text-gray-800'}`}>
                    {test.testName} {test.isAbnormalFlag && <Activity className="w-3 h-3 inline text-red-500 ml-1" />}
                  </p>
                  {test.referenceRange && test.referenceRange !== 'UNREADABLE' && (
                    <p className="text-xs text-gray-500 mt-0.5">Ref: {test.referenceRange}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-bold ${test.isAbnormalFlag ? 'text-red-700' : 'text-gray-900'}`}>
                    {test.value} <span className="text-xs font-normal text-gray-500">{test.unit && test.unit !== 'UNREADABLE' ? test.unit : ''}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {record.sourceImageUrl && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a href={record.sourceImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                View Source Document
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!activeProfileId) {
    return (
      <div className="max-w-3xl mx-auto mt-8 text-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <p className="text-gray-500">Please select a family member profile from the top header to view their timeline.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 pb-12">
      <div className="mb-8 flex flex-col sm:flex-row gap-4 items-end justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="w-full sm:w-auto flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Record Type</label>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Records</option>
            <option value="PRESCRIPTION">Prescriptions Only</option>
            <option value="LAB_REPORT">Lab Reports Only</option>
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">No health records found for this timeline.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map(record => 
            record.type === 'PRESCRIPTION' 
              ? renderPrescriptionCard(record) 
              : renderLabReportCard(record)
          )}
        </div>
      )}
    </div>
  );
}
