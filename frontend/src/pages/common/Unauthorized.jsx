import { Link } from 'react-router-dom';
import Button from '../../components/shared/Button';

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center text-center p-4 sm:p-10 min-h-[60vh]">
    <p className="font-mono text-sm text-text-muted">403</p>
    <h1 className="font-display text-2xl text-text mt-2">You don't have access to this page</h1>
    <p className="text-sm text-text-muted mt-2 max-w-sm">
      Your account doesn't have permission to view this. If you think this is a mistake, contact an administrator.
    </p>
    <Link to="/" className="mt-6">
      <Button>Back to Browse Events</Button>
    </Link>
  </div>
);

export default Unauthorized;
