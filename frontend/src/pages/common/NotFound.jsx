import { Link } from 'react-router-dom';
import Button from '../../components/shared/Button';

const NotFound = () => (
  <div className="flex flex-col items-center justify-center text-center p-4 sm:p-10 min-h-[60vh]">
    <p className="font-mono text-sm text-text-muted">404</p>
    <h1 className="font-display text-2xl text-text mt-2">Page not found</h1>
    <p className="text-sm text-text-muted mt-2 max-w-sm">
      The page you're looking for doesn't exist or may have moved.
    </p>
    <Link to="/" className="mt-6">
      <Button>Back to Browse Events</Button>
    </Link>
  </div>
);

export default NotFound;
