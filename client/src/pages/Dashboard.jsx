import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, Clock, MessageSquare } from 'lucide-react';

const features = [
  {
    title: 'Upload Document',
    description: 'Scan a prescription or lab report using AI-powered extraction.',
    icon: Upload,
    path: '/upload',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    hoverColor: 'hover:border-indigo-300 hover:shadow-indigo-100',
  },
  {
    title: 'Manual Entry',
    description: 'Manually enter prescription or lab report details.',
    icon: FileText,
    path: '/manual',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    hoverColor: 'hover:border-emerald-300 hover:shadow-emerald-100',
  },
  {
    title: 'View Timeline',
    description: 'Browse the complete health record timeline with filters.',
    icon: Clock,
    path: '/timeline',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    hoverColor: 'hover:border-amber-300 hover:shadow-amber-100',
  },
  {
    title: 'Chat with AI',
    description: 'Ask questions grounded in your health records and medicine data.',
    icon: MessageSquare,
    path: '/chat',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
    hoverColor: 'hover:border-purple-300 hover:shadow-purple-100',
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">
          Select a family member from the header, then choose what you'd like to do.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <button
              key={feature.path}
              onClick={() => navigate(feature.path)}
              className={`group text-left p-6 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200 ${feature.hoverColor} hover:shadow-md`}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 ${feature.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
