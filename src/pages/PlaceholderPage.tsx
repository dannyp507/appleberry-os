import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Construction className="w-10 h-10" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          This module is currently under development. We are working hard to bring you the best experience!
        </p>
      </div>
      <button 
        onClick={() => window.history.back()}
        className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-all"
      >
        Go Back
      </button>
    </div>
  );
}
