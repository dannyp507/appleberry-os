import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Calendar, Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { safeFormatDate } from '../lib/utils';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord } from '../lib/companyData';

type Appointment = {
  id: string;
  company_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  service?: string;
  date?: string;
  time?: string;
  status?: string;
  notes?: string;
};

export default function Appointments() {
  const { companyId } = useTenant();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, [companyId]);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const appointmentsSnap = await getDocs(collection(db, 'appointments'));
      const appointmentsData = appointmentsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
        .filter(appointment => !companyId || !isCompanyScopedRecord(appointment) || appointment.company_id === companyId);

      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appointment Calendar</h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Calendar className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-medium text-gray-900">{appointment.customer_name || 'Unknown Customer'}</h3>
                <p className="text-sm text-gray-500">{appointment.customer_phone}</p>
                <p className="text-sm font-medium text-primary">{appointment.service}</p>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {appointment.status || 'Scheduled'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              {safeFormatDate(appointment.date)}
              <Clock className="h-4 w-4 ml-2" />
              {appointment.time}
            </div>
            {appointment.notes && (
              <p className="mt-2 text-sm text-gray-600">{appointment.notes}</p>
            )}
          </div>
        ))}
      </div>

      {appointments.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments scheduled</h3>
          <p className="mt-1 text-sm text-gray-500">Schedule your first appointment to get started.</p>
        </div>
      )}
    </div>
  );
}