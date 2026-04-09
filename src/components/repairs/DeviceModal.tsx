import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (device: { name: string; imei: string }) => void;
}

export default function DeviceModal({ isOpen, onClose, onSuccess }: DeviceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    imei: '',
    serial_number: '',
    color: '',
    model_number: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    onSuccess({ name: formData.name, imei: formData.imei });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Add New Device</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device Name*</label>
            <input
              type="text"
              required
              placeholder="e.g. iPhone 13 Pro"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMEI</label>
            <input
              type="text"
              placeholder="15-digit IMEI number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={formData.imei}
              onChange={e => setFormData({...formData, imei: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                placeholder="e.g. Graphite"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={formData.color}
                onChange={e => setFormData({...formData, color: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model No.</label>
              <input
                type="text"
                placeholder="e.g. A2638"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={formData.model_number}
                onChange={e => setFormData({...formData, model_number: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Add Device
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
