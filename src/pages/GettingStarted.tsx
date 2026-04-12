import { CheckCircle, Circle, ArrowRight } from 'lucide-react';

const steps = [
  {
    title: 'Complete Your Profile',
    description: 'Set up your business information and preferences.',
    completed: false,
  },
  {
    title: 'Add Your First Product',
    description: 'Start building your inventory by adding products or services.',
    completed: false,
  },
  {
    title: 'Set Up Payment Methods',
    description: 'Configure how you accept payments from customers.',
    completed: false,
  },
  {
    title: 'Invite Your Team',
    description: 'Add staff members and assign roles and permissions.',
    completed: false,
  },
  {
    title: 'Customize Your Store',
    description: 'Personalize your point of sale interface and branding.',
    completed: false,
  },
  {
    title: 'Run Your First Sale',
    description: 'Process your first transaction and get familiar with the system.',
    completed: false,
  },
];

export default function GettingStarted() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Appleberry OS!</h1>
        <p className="mt-2 text-lg text-gray-600">
          Let's get you set up and running in no time. Follow these steps to complete your setup.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 bg-white">
              <div className="flex-shrink-0">
                {step.completed ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
              <div className="flex-shrink-0">
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90">
            Start Setup
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h2>
        <p className="text-blue-700">
          If you have any questions or need assistance, check out our documentation or contact support.
        </p>
        <div className="mt-4 space-x-4">
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            View Documentation
          </button>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}