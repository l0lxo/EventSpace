import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import EventForm from '../../components/events/EventForm';

const CreateEvent = () => {
  const navigate = useNavigate();

  const handleSubmit = async (payload) => {
    await api.post('/events', payload);
    navigate('/organizer/events');
  };

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">Create Event</h1>
      <EventForm
        defaultValues={{
          title: '',
          description: '',
          date: '',
          time: '',
          location: '',
          capacity: '',
          category: '',
          fundingRequested: false,
          fundingBudget: '',
          fundingJustification: '',
          guestsRequested: false,
          guestsReason: '',
        }}
        onSubmit={handleSubmit}
        submitLabel="Submit for review"
        enforceAdvanceNotice
      />
    </div>
  );
};

export default CreateEvent;
