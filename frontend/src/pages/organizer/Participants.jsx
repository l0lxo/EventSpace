import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import StatusBadge from '../../components/shared/StatusBadge';

const Participants = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState(null);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/bookings/event/${id}`),
    ])
      .then(([eventRes, participantsRes]) => {
        if (!active) return;
        setEvent(eventRes.data.event);
        setParticipants(participantsRes.data.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message ?? 'Could not load participants.');
        setParticipants([]);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleExport = () => {
    // fetched as an authenticated blob since a plain <a href> can't carry the JWT
    setIsExporting(true);
    api
      .get(`/bookings/event/${id}/export`, { responseType: 'blob' })
      .then((res) => {
        const disposition = res.headers['content-disposition'] ?? '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : 'participants.csv';

        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Could not export the CSV.'))
      .finally(() => setIsExporting(false));
  };

  if (participants === null) {
    return <p className="p-4 sm:p-10 text-text-muted">Loading participants…</p>;
  }

  if (error && !event) {
    return (
      <div className="p-4 sm:p-10">
        <p className="text-danger">{error}</p>
        <Link to="/organizer/events" className="text-accent text-sm">← Back to my events</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10">
      <Link to="/organizer/events" className="text-accent text-sm">← Back to my events</Link>

      <div className="flex flex-wrap justify-between items-end gap-3 mt-4 mb-5">
        <div>
          <h1 className="font-display text-2xl text-text">{event?.title}</h1>
          <p className="text-sm text-text-muted">{participants.length} participant(s)</p>
        </div>
        <Button
          variant="secondary"
          isLoading={isExporting}
          disabled={participants.length === 0}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {participants.length === 0 ? (
        <p className="text-text-muted">No bookings yet for this event.</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Student ID</th>
                  <th className="py-2 pr-4">Booked</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.bookingId} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-text">{p.studentName}</td>
                    <td className="py-2 pr-4 text-text-muted">{p.studentEmail}</td>
                    <td className="py-2 pr-4 font-mono text-text">{p.studentID}</td>
                    <td className="py-2 pr-4 font-mono text-text-muted">
                      {format(parseISO(p.bookingDate), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Participants;
